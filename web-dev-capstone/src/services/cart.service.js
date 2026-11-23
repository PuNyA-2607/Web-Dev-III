import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Standard monetary rounding helper (2 decimal places).
 * Ensures consistency across cart calculations and prevents floating-point inaccuracies.
 *
 * @param {number} amount
 * @returns {number}
 */
export const roundMoney = (amount) => {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
};

export const cartService = {
  /**
   * Get the current user's cart with live product data, computed totals, and stock status flags.
   * If a product is out-of-stock or deactivated, it flags the issue without silently deleting the item.
   */
  getCart: async (userId) => {
    // 1. Atomic upsert ensures one cart per user without race conditions
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, items: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate({
      path: 'items.product',
      select: 'name price stock isActive images',
    });

    let subtotal = 0;
    let itemCount = 0;

    const items = cart.items.map((item) => {
      const product = item.product;

      // Handle deleted or deactivated products
      if (!product || !product.isActive) {
        return {
          product: {
            id: product ? product._id : item.product,
            name: product ? product.name : 'Unavailable Product',
            price: product ? product.price : 0,
            images: product ? product.images : [],
          },
          quantity: item.quantity,
          lineTotal: 0,
          availableStock: product ? product.stock : 0,
          available: false,
          issue: 'PRODUCT_UNAVAILABLE',
        };
      }

      // Handle insufficient stock
      if (product.stock < item.quantity) {
        const lineTotal = roundMoney(product.price * item.quantity);
        return {
          product: {
            id: product._id,
            name: product.name,
            price: product.price,
            images: product.images,
          },
          quantity: item.quantity,
          lineTotal,
          availableStock: product.stock,
          available: false,
          issue: 'INSUFFICIENT_STOCK',
        };
      }

      // Healthy, available line item
      const lineTotal = roundMoney(product.price * item.quantity);
      subtotal = roundMoney(subtotal + lineTotal);
      itemCount += item.quantity;

      return {
        product: {
          id: product._id,
          name: product.name,
          price: product.price,
          images: product.images,
        },
        quantity: item.quantity,
        lineTotal,
        availableStock: product.stock,
        available: true,
        issue: null,
      };
    });

    return {
      _id: cart._id,
      user: cart.user,
      items,
      itemCount,
      subtotal,
      total: subtotal, // Extensible for tax/shipping in later phases
      updatedAt: cart.updatedAt,
    };
  },

  /**
   * Add an item to the user's cart or increment its quantity.
   */
  addItem: async (userId, productId, quantity = 1) => {
    // 1. Verify product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw ApiError.notFound('Product not found or is currently unavailable.');
    }

    // 2. Fetch or create cart atomically
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, items: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    let targetQuantity = quantity;

    if (existingIndex > -1) {
      targetQuantity = cart.items[existingIndex].quantity + quantity;
    } else {
      // Limit distinct item lines per cart to 50
      if (cart.items.length >= 50) {
        throw ApiError.badRequest('Cart cannot contain more than 50 distinct items.');
      }
    }

    // 3. Enforce maximum line quantity (99) and available stock limits
    if (targetQuantity > 99) {
      throw ApiError.badRequest('Maximum allowed quantity per item is 99.');
    }

    if (targetQuantity > product.stock) {
      throw ApiError.conflict(
        `Requested quantity (${targetQuantity}) exceeds available stock (${product.stock}).`
      );
    }

    // 4. Update cart state
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity = targetQuantity;
    } else {
      cart.items.push({ product: productId, quantity: targetQuantity });
    }

    await cart.save();

    // Return fresh, fully computed cart representation
    return await cartService.getCart(userId);
  },

  /**
   * Set the exact quantity for an item in the cart.
   */
  updateItem: async (userId, productId, quantity) => {
    // 1. Verify product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw ApiError.notFound('Product not found or is currently unavailable.');
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw ApiError.notFound('Cart not found.');
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      throw ApiError.notFound('Product not found in your cart.');
    }

    // 2. Stock and maximum quantity checks
    if (quantity > 99) {
      throw ApiError.badRequest('Maximum allowed quantity per item is 99.');
    }

    if (quantity > product.stock) {
      throw ApiError.conflict(
        `Requested quantity (${quantity}) exceeds available stock (${product.stock}).`
      );
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();

    return await cartService.getCart(userId);
  },

  /**
   * Remove a specific product line from the cart.
   */
  removeItem: async (userId, productId) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw ApiError.notFound('Cart not found.');
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId.toString()
    );

    if (cart.items.length === initialLength) {
      throw ApiError.notFound('Product not found in your cart.');
    }

    await cart.save();
    return await cartService.getCart(userId);
  },

  /**
   * Empty all items from the user's cart.
   */
  clearCart: async (userId) => {
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return await cartService.getCart(userId);
  },

  /**
   * Validates cart items right before checkout.
   * Re-reads every product fresh from the database to guarantee price and stock accuracy.
   * Throws 409 Conflict listing every problem line if anything is missing, deactivated, or understocked.
   * Exported for direct reuse by Phase 5 checkout service.
   *
   * @param {string} userId
   * @returns {Promise<{ cart: Object, items: Array, subtotal: number, total: number, itemCount: number }>}
   */
  validateCartForCheckout: async (userId) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      throw ApiError.badRequest('Cannot checkout with an empty cart.');
    }

    // Fresh batch fetch of all products in the cart
    const productIds = cart.items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const validatedItems = [];
    const issues = [];
    let subtotal = 0;
    let itemCount = 0;

    for (const item of cart.items) {
      const product = productMap.get(item.product.toString());

      // 1. Missing or deactivated product check
      if (!product || !product.isActive) {
        issues.push({
          productId: item.product,
          name: product ? product.name : 'Unknown Product',
          issue: 'PRODUCT_UNAVAILABLE',
          message: 'Product is no longer available or has been removed.',
        });
        continue;
      }

      // 2. Insufficient stock check
      if (product.stock < item.quantity) {
        issues.push({
          productId: product._id,
          name: product.name,
          requestedQuantity: item.quantity,
          availableStock: product.stock,
          issue: 'INSUFFICIENT_STOCK',
          message: `Only ${product.stock} unit(s) remaining in stock.`,
        });
        continue;
      }

      // 3. Validated line item
      const lineTotal = roundMoney(product.price * item.quantity);
      subtotal = roundMoney(subtotal + lineTotal);
      itemCount += item.quantity;

      validatedItems.push({
        product: product._id,
        name: product.name,
        price: product.price, // Live price snapshot
        priceSnapshot: product.price,
        quantity: item.quantity,
        seller: product.seller,
        lineTotal,
      });
    }

    // If any product is unavailable or understocked, reject the checkout attempt
    if (issues.length > 0) {
      throw ApiError.conflict('Cart validation failed. Please review the affected items.', issues);
    }

    return {
      cart,
      items: validatedItems,
      subtotal,
      total: subtotal,
      itemCount,
    };
  },
};
