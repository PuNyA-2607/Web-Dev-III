import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getSellerProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validations/common.validation.js';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from '../validations/product.validation.js';

const router = Router();

/**
 * @route   GET /api/v1/products
 * @desc    Search, filter, sort and paginate products (public)
 * @access  Public
 */
router.get('/', validate(productQuerySchema, 'query'), getAllProducts);

/**
 * @route   GET /api/v1/products/mine
 * @desc    Get currently logged in seller's products (including inactive)
 * @access  Private (Seller only)
 * NOTE: Defined BEFORE /:id route so 'mine' is not interpreted as an ObjectId.
 */
router.get('/mine', authenticate, authorize('seller'), getSellerProducts);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product by ID (public)
 * @access  Public
 */
router.get('/:id', validate(idParamSchema, 'params'), getProductById);

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Private (Seller, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('seller', 'admin'),
  validate(createProductSchema, 'body'),
  createProduct
);

/**
 * @route   PATCH /api/v1/products/:id
 * @desc    Update product (Owner seller or Admin only)
 * @access  Private (Seller, Admin)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  validate(idParamSchema, 'params'),
  validate(updateProductSchema, 'body'),
  updateProduct
);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Soft-delete product (Owner seller or Admin only)
 * @access  Private (Seller, Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  validate(idParamSchema, 'params'),
  deleteProduct
);

export default router;
