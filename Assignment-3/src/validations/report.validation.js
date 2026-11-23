import Joi from 'joi';

export const salesReportQuerySchema = Joi.object({
  from: Joi.date().iso().optional().messages({
    'date.format': 'from date must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)',
  }),
  to: Joi.date().iso().optional().messages({
    'date.format': 'to date must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)',
  }),
}).custom((value, helpers) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
    return helpers.message({ custom: "'from' date cannot be later than 'to' date" });
  }
  return value;
});

export const bestSellersQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
});
