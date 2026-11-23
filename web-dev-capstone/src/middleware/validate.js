import { ApiError } from '../utils/ApiError.js';

/**
 * Joi Schema Validation Middleware
 * Validates request data (body, query, or params) against a Joi schema.
 *
 * @param {import('joi').ObjectSchema} schema - Joi schema definition
 * @param {'body'|'query'|'params'} [property='body'] - Request property to validate
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all validation errors, not just the first
      stripUnknown: true, // Remove keys that are not defined in the schema
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));

      return next(ApiError.badRequest('Validation failed', errorDetails));
    }

    // Replace request property with sanitized/validated value
    req[property] = value;
    next();
  };
};
