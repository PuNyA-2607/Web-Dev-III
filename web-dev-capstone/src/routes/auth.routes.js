import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../validations/auth.validation.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new customer or seller
 * @access  Public
 */
router.post('/register', validate(registerSchema), register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and issue access & refresh tokens (Rate-limited to 10 attempts / 15 min)
 * @access  Public
 */
router.post('/login', loginRateLimiter, validate(loginSchema), login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Rotate refresh token and issue new token pair
 * @access  Public
 */
router.post('/refresh', validate(refreshTokenSchema), refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Revoke the given refresh token
 * @access  Public
 */
router.post('/logout', validate(refreshTokenSchema), logout);

export default router;
