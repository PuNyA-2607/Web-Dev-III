import Joi from 'joi';

/**
 * 24-character hexadecimal MongoDB ObjectId validator
 */
export const objectIdSchema = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    'string.pattern.base': 'Invalid ObjectId format. Must be a 24-character hex string.',
    'string.empty': 'ID cannot be empty',
  });

/**
 * Common schema for validating URL parameter with :id
 */
export const idParamSchema = Joi.object({
  id: objectIdSchema.required().messages({
    'any.required': 'Resource ID parameter is required',
  }),
});

/**
 * Common schema for validating URL parameter with :productId
 */
export const productIdParamSchema = Joi.object({
  productId: objectIdSchema.required().messages({
    'any.required': 'Product ID parameter is required',
  }),
});
