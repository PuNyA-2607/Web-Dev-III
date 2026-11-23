import Joi from 'joi';

export const checkoutSchema = Joi.object({
  deliveryAddress: Joi.object({
    street: Joi.string().trim().min(3).max(150).required().messages({
      'any.required': 'Street address is required',
    }),
    city: Joi.string().trim().min(2).max(100).required().messages({
      'any.required': 'City is required',
    }),
    state: Joi.string().trim().min(2).max(100).required().messages({
      'any.required': 'State is required',
    }),
    postalCode: Joi.string().trim().min(3).max(20).required().messages({
      'any.required': 'Postal/ZIP code is required',
    }),
    country: Joi.string().trim().min(2).max(60).default('IN'),
  }).required().messages({
    'any.required': 'Delivery address is required for checkout',
  }),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('confirmed', 'shipped', 'delivered', 'cancelled')
    .required()
    .messages({
      'any.only': 'Status must be one of: confirmed, shipped, delivered, cancelled',
      'any.required': 'New status is required',
    }),
  note: Joi.string().trim().max(500).allow('').optional(),
});

export const orderQuerySchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
    .optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(50).default(10).optional(),
});
