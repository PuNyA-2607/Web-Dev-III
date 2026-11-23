import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Authentication Middleware
 * Validates the JWT access token in the Authorization header and attaches the user to req.user.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token missing. Please provide a Bearer token.');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token has expired. Please refresh your token.');
    }
    throw ApiError.unauthorized('Invalid access token.');
  }

  // Load user from database to ensure user still exists and isActive
  const user = await User.findById(decoded.id);

  if (!user) {
    throw ApiError.unauthorized('User account associated with this token no longer exists.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Please contact support.');
  }

  // Attach user object to request
  req.user = user;
  next();
});
