import Joi from 'joi';

export const updateMeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
  }),
  currentPassword: Joi.string().when('password', {
    is: Joi.exist(),
    then: Joi.required().messages({
      'any.required': 'Current password is required to set a new password',
    }),
    otherwise: Joi.optional(),
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.max': 'New password cannot exceed 128 characters',
      'string.pattern.base': 'New password must contain at least one letter and one number',
    }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field (name or password) must be provided to update',
  });

export const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'boolean.base': 'isActive must be a boolean (true or false)',
    'any.required': 'isActive field is required',
  }),
});
