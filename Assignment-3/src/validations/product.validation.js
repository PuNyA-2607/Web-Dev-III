import Joi from 'joi';
import { objectIdSchema } from './common.validation.js';

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required().messages({
    'string.base': 'Product name must be a string',
    'string.empty': 'Product name cannot be empty',
    'string.min': 'Product name must be at least 2 characters long',
    'string.max': 'Product name cannot exceed 120 characters',
    'any.required': 'Product name is required',
  }),
  description: Joi.string().trim().min(5).max(2000).required().messages({
    'string.min': 'Description must be at least 5 characters long',
    'string.max': 'Description cannot exceed 2000 characters',
    'any.required': 'Product description is required',
  }),
  price: Joi.number().min(0).precision(2).required().messages({
    'number.base': 'Price must be a valid number',
    'number.min': 'Price cannot be negative',
    'any.required': 'Price is required',
  }),
  category: objectIdSchema.required().messages({
    'any.required': 'Category ID is required',
  }),
  seller: objectIdSchema.optional().messages({
    'string.pattern.base': 'Invalid seller ID format',
  }),
  stock: Joi.number().integer().min(0).required().messages({
    'number.base': 'Stock must be a number',
    'number.integer': 'Stock must be an integer',
    'number.min': 'Stock cannot be negative',
    'any.required': 'Stock count is required',
  }),
  lowStockThreshold: Joi.number().integer().min(0).default(5).messages({
    'number.integer': 'Low stock threshold must be an integer',
    'number.min': 'Low stock threshold cannot be negative',
  }),
  images: Joi.array().items(Joi.string().trim().uri({ scheme: ['http', 'https'] }).allow('')).optional(),
  isActive: Joi.boolean().default(true),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).messages({
    'string.min': 'Product name must be at least 2 characters long',
    'string.max': 'Product name cannot exceed 120 characters',
  }),
  description: Joi.string().trim().min(5).max(2000).messages({
    'string.min': 'Description must be at least 5 characters long',
    'string.max': 'Description cannot exceed 2000 characters',
  }),
  price: Joi.number().min(0).precision(2).messages({
    'number.min': 'Price cannot be negative',
  }),
  category: objectIdSchema.messages({
    'string.pattern.base': 'Invalid category ID format',
  }),
  stock: Joi.number().integer().min(0).messages({
    'number.integer': 'Stock must be an integer',
    'number.min': 'Stock cannot be negative',
  }),
  lowStockThreshold: Joi.number().integer().min(0).messages({
    'number.integer': 'Low stock threshold must be an integer',
    'number.min': 'Low stock threshold cannot be negative',
  }),
  images: Joi.array().items(Joi.string().trim()),
  isActive: Joi.boolean(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update the product',
  });

export const productQuerySchema = Joi.object({
  search: Joi.string().trim().max(100).optional(),
  category: objectIdSchema.optional(),
  seller: objectIdSchema.optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  inStock: Joi.boolean().optional(),
  sort: Joi.string()
    .valid('price', '-price', 'createdAt', '-createdAt', 'name', '-name')
    .optional()
    .messages({
      'any.only': 'Sort must be one of: price, -price, createdAt, -createdAt, name, -name',
    }),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(50).default(10).optional(),
});
