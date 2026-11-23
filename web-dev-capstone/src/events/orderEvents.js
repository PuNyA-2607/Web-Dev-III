import { eventEmitter } from './eventEmitter.js';
import {
  emitOrderNew,
  emitOrderStatus,
  emitStockLow,
} from '../socket/socketServer.js';
import { logger } from '../utils/logger.js';

/**
 * Register Order & Inventory Event Listeners
 *
 * ARCHITECTURAL RULE:
 * Services only emit decoupled Node.js EventEmitter domain events.
 * All real-time WebSocket emissions and external side-effects are processed here.
 */
export const registerOrderEvents = () => {
  /**
   * Event: order:placed
   * Purpose:
   *   Fires immediately after an order transaction successfully commits.
   *   Groups order items by seller and pushes a real-time 'order:new' notification
   *   to each seller's private WebSocket room (user:<sellerId>).
   */
  eventEmitter.on('order:placed', (order) => {
    try {
      logger.info(`[Event] order:placed received for Order ID: ${order._id}`);

      // Extract distinct sellers who have items in this order
      const sellerIds = [...new Set(order.items.map((item) => item.seller.toString()))];

      for (const sellerId of sellerIds) {
        emitOrderNew(sellerId, {
          orderId: order._id,
          status: order.status,
          message: 'You have received a new customer order!',
          total: order.total,
          itemsCount: order.items.filter((i) => i.seller.toString() === sellerId).length,
        });
      }
    } catch (err) {
      logger.error(`Error processing 'order:placed' event: ${err.message}`);
    }
  });

  /**
   * Event: order:statusChanged
   * Purpose:
   *   Fires when an order transitions state (e.g. pending -> confirmed -> shipped -> delivered or cancelled).
   *   Notifies the purchasing customer via their private WebSocket room (user:<customerId>)
   *   so their live UI updates instantly without polling.
   */
  eventEmitter.on('order:statusChanged', ({ orderId, status, customer }) => {
    try {
      logger.info(`[Event] order:statusChanged for Order ID: ${orderId} -> ${status}`);

      emitOrderStatus(customer, {
        orderId,
        status,
        message: `Your order #${orderId} status has been updated to '${status}'.`,
      });
    } catch (err) {
      logger.error(`Error processing 'order:statusChanged' event: ${err.message}`);
    }
  });

  /**
   * Event: stock:low
   * Purpose:
   *   Fires when an inventory decrement pushes a product's stock count to or below
   *   its configured lowStockThreshold. Broadcasts a high-priority 'stock:low' warning
   *   to both the owning seller and the platform administrator room (role:admin)
   *   so stock can be replenished before going out of stock.
   */
  eventEmitter.on('stock:low', ({ productId, productName, stock, threshold, seller }) => {
    try {
      logger.warn(
        `[Event] stock:low warning: Product '${productName}' (ID: ${productId}) has ${stock} unit(s) remaining (Threshold: ${threshold})`
      );

      emitStockLow(seller, {
        productId,
        productName,
        stock,
        threshold,
        message: `Low stock alert: '${productName}' has only ${stock} unit(s) remaining!`,
      });
    } catch (err) {
      logger.error(`Error processing 'stock:low' event: ${err.message}`);
    }
  });

  logger.info('Order domain event listeners registered successfully.');
};
