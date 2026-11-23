import { Router } from 'express';
import {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
} from '../controllers/cart.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { productIdParamSchema } from '../validations/common.validation.js';
import { addItemSchema, updateItemSchema } from '../validations/cart.validation.js';

const router = Router();

// Strict RBAC: All cart routes require authentication and strictly 'customer' role.
// Sellers and Admins receive 403 Forbidden.
// The cart identity is always derived from req.user._id, preventing cross-tenant cart tampering.
router.use(authenticate, authorize('customer'));

/**
 * @route   GET /api/v1/cart
 * @desc    Get currently authenticated customer's cart
 * @access  Private (Customer only)
 */
router.get('/', getCart);

/**
 * @route   POST /api/v1/cart/items
 * @desc    Add an item to the cart or increment quantity
 * @access  Private (Customer only)
 */
router.post('/items', validate(addItemSchema, 'body'), addItem);

/**
 * @route   PATCH /api/v1/cart/items/:productId
 * @desc    Update quantity for a cart line item
 * @access  Private (Customer only)
 */
router.patch(
  '/items/:productId',
  validate(productIdParamSchema, 'params'),
  validate(updateItemSchema, 'body'),
  updateItem
);

/**
 * @route   DELETE /api/v1/cart/items/:productId
 * @desc    Remove an item from the cart
 * @access  Private (Customer only)
 */
router.delete(
  '/items/:productId',
  validate(productIdParamSchema, 'params'),
  removeItem
);

/**
 * @route   DELETE /api/v1/cart
 * @desc    Clear all items from the cart
 * @access  Private (Customer only)
 */
router.delete('/', clearCart);

export default router;
