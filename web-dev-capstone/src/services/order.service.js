import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { cartService } from './cart.service.js';
import { validateTransition } from '../utils/orderStateMachine.js';
import { eventEmitter } from '../events/eventEmitter.js';
import { ApiError } from '../utils/ApiError.js';

export const orderService = {
  /**
   * Checkout: Converts the user's current shopping cart into a placed order.
   *
   * ATOMIC INVENTORY & TRANSACTION LOGIC:
   * 1. Pre-validates cart with validateCartForCheckout()
   * 2. Runs inside an ACID MongoDB multi-document transaction (session.withTransaction)
   * 3. Conditionally decrements inventory for each product:
   *      Product.updateOne({ _id, stock: { $gte: qty }, isActive: true }, { $inc: { stock: -qty } })
   *    Guarantees stock NEVER drops below 0 even under massive concurrent checkouts.
   * 4. Creates order document with price snapshots and simulated payment.
   * 5. Empties the cart atomically.
   * 6. Emits domain events ('order:placed', 'stock:low') after successful transaction commit.
   */
  checkout: async (userId, deliveryAddress) => {
    // 1. Initial cart validation
    const validatedCart = await cartService.validateCartForCheckout(userId);

    const session = await mongoose.startSession();
    let createdOrder;
    const lowStockAlerts = [];

    try {
      await session.withTransaction(async () => {
        // 2. Decrement stock for each item conditionally and atomically
        for (const item of validatedCart.items) {
          const updateResult = await Product.updateOne(
            {
              _id: item.product,
              stock: { $gte: item.quantity },
              isActive: true,
            },
            {
              $inc: { stock: -item.quantity },
            },
            { session }
          );

          // If modifiedCount is 0, another concurrent transaction purchased the stock first
          if (updateResult.modifiedCount === 0) {
            throw ApiError.conflict(
              `Insufficient stock for product '${item.name}' or product was modified during checkout.`
            );
          }

          // Fetch updated product state to check for low stock warning
          const updatedProduct = await Product.findById(item.product).session(session);
          if (
            updatedProduct &&
            updatedProduct.stock <= updatedProduct.lowStockThreshold
          ) {
            lowStockAlerts.push({
              productId: updatedProduct._id,
              productName: updatedProduct.name,
              stock: updatedProduct.stock,
              threshold: updatedProduct.lowStockThreshold,
              seller: updatedProduct.seller,
            });
          }
        }

        // 3. Create Order with price snapshots
        const [order] = await Order.create(
          [
            {
              customer: userId,
              items: validatedCart.items.map((i) => ({
                product: i.product,
                seller: i.seller,
                name: i.name,
                priceSnapshot: i.priceSnapshot,
                quantity: i.quantity,
              })),
              total: validatedCart.total,
              status: 'pending',
              payment: {
                method: 'SIMULATED',
                status: 'COMPLETED',
              },
              deliveryAddress,
              statusHistory: [
                {
                  status: 'pending',
                  by: userId,
                  at: new Date(),
                  note: 'Order placed via simulated checkout',
                },
              ],
            },
          ],
          { session }
        );

        createdOrder = order;

        // 4. Atomically clear user's cart
        await Cart.updateOne({ user: userId }, { $set: { items: [] } }, { session });
      });
    } finally {
      session.endSession();
    }

    // 5. Fire decoupled EventEmitter events outside the database transaction
    eventEmitter.emit('order:placed', createdOrder);

    for (const alert of lowStockAlerts) {
      eventEmitter.emit('stock:low', alert);
    }

    return await Order.findById(createdOrder._id)
      .populate('customer', 'name email')
      .populate('items.product', 'images name price');
  },

  /**
   * Get paginated orders based on user role:
   * - Customer: view own orders
   * - Seller: view orders that include at least one item they sell
   * - Admin: view all orders across the platform
   */
  getOrders: async (currentUser, queryParams = {}) => {
    const filter = {};

    if (currentUser.role === 'customer') {
      filter.customer = currentUser._id;
    } else if (currentUser.role === 'seller') {
      filter['items.seller'] = currentUser._id;
    }
    // Admins have unrestricted access (filter remains empty unless status is provided)

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email')
        .populate('items.seller', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single order by ID with strict ownership validation
   */
  getOrderById: async (orderId, currentUser) => {
    const order = await Order.findById(orderId)
      .populate('customer', 'name email')
      .populate('items.product', 'name images')
      .populate('items.seller', 'name email')
      .populate('statusHistory.by', 'name role');

    if (!order) {
      throw ApiError.notFound('Order not found.');
    }

    // Ownership check
    if (currentUser.role === 'customer') {
      if (order.customer._id.toString() !== currentUser._id.toString()) {
        throw ApiError.forbidden('Forbidden: You can only view your own orders.');
      }
    } else if (currentUser.role === 'seller') {
      const hasSellerItem = order.items.some(
        (item) => item.seller._id.toString() === currentUser._id.toString()
      );
      if (!hasSellerItem) {
        throw ApiError.forbidden('Forbidden: You do not have products in this order.');
      }
    }

    return order;
  },

  /**
   * Update order status following the strict finite state machine:
   * pending -> confirmed -> shipped -> delivered
   * Allowed for Seller (who owns items in the order) or Admin.
   */
  updateOrderStatus: async (orderId, targetStatus, currentUser, note = '') => {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found.');
    }

    // Role & Ownership check
    if (currentUser.role === 'seller') {
      const hasSellerItem = order.items.some(
        (item) => item.seller.toString() === currentUser._id.toString()
      );
      if (!hasSellerItem) {
        throw ApiError.forbidden('Forbidden: You can only update orders containing your products.');
      }
    } else if (currentUser.role !== 'admin') {
      throw ApiError.forbidden('Only sellers and administrators can update order progress.');
    }

    // Enforce Finite State Machine rules
    validateTransition(order.status, targetStatus);

    order.status = targetStatus;
    order.statusHistory.push({
      status: targetStatus,
      by: currentUser._id,
      at: new Date(),
      note: note || `Status progressed to '${targetStatus}'`,
    });

    await order.save();

    // Fire decoupled status event for WebSocket push
    eventEmitter.emit('order:statusChanged', {
      orderId: order._id,
      status: targetStatus,
      customer: order.customer,
    });

    return await Order.findById(order._id)
      .populate('customer', 'name email')
      .populate('items.seller', 'name email');
  },

  /**
   * Cancel order:
   * - Allowed for Customer (own order), Seller (with items in order), or Admin.
   * - ONLY permitted from 'pending' or 'confirmed' states.
   * - Cannot cancel twice.
   * - Restores product stock inside an ACID transaction.
   */
  cancelOrder: async (orderId, currentUser, reason = '') => {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found.');
    }

    // Ownership check
    if (currentUser.role === 'customer') {
      if (order.customer.toString() !== currentUser._id.toString()) {
        throw ApiError.forbidden('Forbidden: You can only cancel your own orders.');
      }
    } else if (currentUser.role === 'seller') {
      const hasSellerItem = order.items.some(
        (item) => item.seller.toString() === currentUser._id.toString()
      );
      if (!hasSellerItem) {
        throw ApiError.forbidden('Forbidden: You can only cancel orders containing your products.');
      }
    }

    // Double cancellation check
    if (order.status === 'cancelled') {
      throw ApiError.badRequest('Order is already cancelled and cannot be cancelled twice.');
    }

    // Enforce cancellation state machine rule (only pending or confirmed)
    if (!['pending', 'confirmed'].includes(order.status)) {
      throw ApiError.badRequest(
        `Order cannot be cancelled in '${order.status}' status. Only 'pending' and 'confirmed' orders can be cancelled.`
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Restore inventory stock for all products in the cancelled order
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session }
          );
        }

        order.status = 'cancelled';
        order.statusHistory.push({
          status: 'cancelled',
          by: currentUser._id,
          at: new Date(),
          note: reason || 'Order cancelled; inventory restored.',
        });

        await order.save({ session });
      });
    } finally {
      session.endSession();
    }

    // Fire decoupled status event for WebSocket push
    eventEmitter.emit('order:statusChanged', {
      orderId: order._id,
      status: 'cancelled',
      customer: order.customer,
    });

    return await Order.findById(order._id)
      .populate('customer', 'name email')
      .populate('items.seller', 'name email');
  },
};
