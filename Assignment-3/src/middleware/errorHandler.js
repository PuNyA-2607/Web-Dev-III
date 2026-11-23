import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Centralized Error Handling Middleware
 * Catches all errors passed to next(), normalizes them, and returns a consistent JSON payload.
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log all internal/unhandled server errors
  if (!(error instanceof ApiError) || error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${error.message}`, error.stack);
  }

  // Handle Mongoose Bad ObjectId (CastError)
  if (error.name === 'CastError') {
    const message = `Invalid format for field '${error.path}': ${error.value}`;
    error = ApiError.badRequest(message);
  }

  // Handle Mongoose Validation Error
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((val) => val.message);
    error = ApiError.badRequest('Validation error', messages);
  }

  // Handle Mongoose Duplicate Key Error (code 11000)
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    const value = error.keyValue ? error.keyValue[field] : '';
    const message = `Duplicate value '${value}' entered for ${field}. Must be unique.`;
    error = ApiError.conflict(message);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token. Please authenticate again.');
  }

  if (error.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token has expired. Please refresh your token.');
  }

  // Default to 500 if not an operational ApiError
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const errors = error.errors || [];

  const response = {
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    // Include stack trace only in development
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  res.status(statusCode).json(response);
};
