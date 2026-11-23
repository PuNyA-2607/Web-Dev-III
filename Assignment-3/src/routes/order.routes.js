import { Router } from 'express';
import {
  checkout,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/order.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validations/common.validation.js';
import {
  checkoutSchema,
  updateOrderStatusSchema,
  orderQuerySchema,
} from '../validations/order.validation.js';

const router = Router();

// All order routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/orders
 * @desc    Checkout: Validate cart, decrement stock in transaction, create order
 * @access  Private (Customer only)
 */
router.post('/', authorize('customer'), validate(checkoutSchema, 'body'), checkout);

/**
 * @route   GET /api/v1/orders
 * @desc    List orders with role-based filtering (Customer: own; Seller: contains items; Admin: all)
 * @access  Private (All authenticated roles)
 */
router.get('/', validate(orderQuerySchema, 'query'), getOrders);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order details by ID with strict ownership validation
 * @access  Private (Owner customer, relevant seller, or admin)
 */
router.get('/:id', validate(idParamSchema, 'params'), getOrderById);

/**
 * @route   PATCH /api/v1/orders/:id/status
 * @desc    Progress order lifecycle status via finite state machine
 * @access  Private (Seller who owns items in order, or Admin)
 */
router.patch(
  '/:id/status',
  authorize('seller', 'admin'),
  validate(idParamSchema, 'params'),
  validate(updateOrderStatusSchema, 'body'),
  updateOrderStatus
);

/**
 * @route   POST /api/v1/orders/:id/cancel
 * @desc    Cancel order (pending/confirmed only) and restore inventory in a transaction
 * @access  Private (Owner customer, relevant seller, or admin)
 */
router.post('/:id/cancel', validate(idParamSchema, 'params'), cancelOrder);

export default router;
