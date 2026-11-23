import { Router } from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validations/common.validation.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validations/category.validation.js';

const router = Router();

/**
 * @route   GET /api/v1/categories
 * @desc    Get all categories (public)
 * @access  Public
 */
router.get('/', getAllCategories);

/**
 * @route   GET /api/v1/categories/:id
 * @desc    Get category by ID (public)
 * @access  Public
 */
router.get('/:id', validate(idParamSchema, 'params'), getCategoryById);

/**
 * @route   POST /api/v1/categories
 * @desc    Create category (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(createCategorySchema, 'body'),
  createCategory
);

/**
 * @route   PATCH /api/v1/categories/:id
 * @desc    Update category (admin only)
 * @access  Private (Admin)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idParamSchema, 'params'),
  validate(updateCategorySchema, 'body'),
  updateCategory
);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete category (admin only - blocked if contains products)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idParamSchema, 'params'),
  deleteCategory
);

export default router;
