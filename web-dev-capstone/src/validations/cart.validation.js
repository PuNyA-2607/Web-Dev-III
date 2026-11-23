import Joi from 'joi';
import { objectIdSchema } from './common.validation.js';

/**
 * Cart Validation Schemas
 *
 * SECURITY POLICY:
 * Any client-sent 'price', 'total', 'subtotal', or 'user' fields are STRICTLY FORBIDDEN.
 * Prices and totals are computed exclusively on the server from current Product records,
 * and the user identity is derived exclusively from req.user (JWT access token).
 */
export const addItemSchema = Joi.object({
  productId: objectIdSchema.required().messages({
    'any.required': 'Product ID is required',
  }),
  quantity: Joi.number().integer().min(1).max(99).default(1).messages({
    'number.base': 'Quantity must be a number',
    'number.integer': 'Quantity must be an integer',
    'number.min': 'Quantity must be at least 1',
    'number.max': 'Maximum allowed quantity per line is 99',
  }),
  // Explicitly forbid client from attempting to inject prices, totals, or user ID
  price: Joi.forbidden().messages({
    'any.unknown': 'Price tampering rejected: client cannot provide price; prices are fetched server-side.',
  }),
  total: Joi.forbidden().messages({
    'any.unknown': 'Total tampering rejected: client cannot provide total; totals are computed server-side.',
  }),
  subtotal: Joi.forbidden().messages({
    'any.unknown': 'Subtotal tampering rejected: subtotals are computed server-side.',
  }),
  user: Joi.forbidden().messages({
    'any.unknown': 'User field is forbidden; cart ownership is strictly derived from the authentication token.',
  }),
});

export const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(99).required().messages({
    'number.base': 'Quantity must be a number',
    'number.integer': 'Quantity must be an integer',
    'number.min': 'Quantity must be at least 1',
    'number.max': 'Maximum allowed quantity per line is 99',
    'any.required': 'Quantity is required',
  }),
  // Explicitly forbid client from attempting to inject prices, totals, or user ID
  price: Joi.forbidden().messages({
    'any.unknown': 'Price tampering rejected: client cannot provide price.',
  }),
  total: Joi.forbidden().messages({
    'any.unknown': 'Total tampering rejected: client cannot provide total.',
  }),
  subtotal: Joi.forbidden().messages({
    'any.unknown': 'Subtotal tampering rejected: subtotals are computed server-side.',
  }),
  user: Joi.forbidden().messages({
    'any.unknown': 'User field is forbidden.',
  }),
});
