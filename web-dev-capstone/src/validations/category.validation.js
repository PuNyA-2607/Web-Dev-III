import Joi from 'joi';

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    'string.base': 'Category name must be a string',
    'string.empty': 'Category name cannot be empty',
    'string.min': 'Category name must be at least 2 characters long',
    'string.max': 'Category name cannot exceed 50 characters',
    'any.required': 'Category name is required',
  }),
  description: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
  isActive: Joi.boolean().optional(),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).messages({
    'string.min': 'Category name must be at least 2 characters long',
    'string.max': 'Category name cannot exceed 50 characters',
  }),
  description: Joi.string().trim().max(500).allow('').messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
  isActive: Joi.boolean(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update the category',
  });
