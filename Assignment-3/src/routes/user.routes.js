import { Router } from 'express';
import {
  getMe,
  updateMe,
  getAllUsers,
  updateUserStatus,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  updateMeSchema,
  updateUserStatusSchema,
} from '../validations/user.validation.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get currently authenticated user profile
 * @access  Private (Any authenticated user)
 */
router.get('/me', getMe);

/**
 * @route   PATCH /api/v1/users/me
 * @desc    Update current user profile (name, password only)
 * @access  Private (Any authenticated user)
 */
router.patch('/me', validate(updateMeSchema), updateMe);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with pagination and filtering
 * @access  Private (Admin only)
 */
router.get('/', authorize('admin'), getAllUsers);

/**
 * @route   PATCH /api/v1/users/:id/status
 * @desc    Activate or deactivate user account
 * @access  Private (Admin only)
 */
router.patch('/:id/status', authorize('admin'), validate(updateUserStatusSchema), updateUserStatus);

export default router;
