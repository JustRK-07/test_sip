/**
 * Request Validation Middleware using Joi
 */

const Joi = require('joi');
const { AppError } = require('./errorHandler');

// Validate request against Joi schema
const validate = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, // Return all errors
      allowUnknown: true, // Allow unknown keys
      stripUnknown: true, // Remove unknown keys
    };

    const { error, value } = schema.validate(req.body, validationOptions);

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      return next(new AppError(errorMessage, 400));
    }

    // Replace req.body with validated value
    req.body = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // Campaign validation
  createCampaign: Joi.object({
    name: Joi.string().required().min(3).max(255),
    description: Joi.string().optional().allow(''),
    maxConcurrent: Joi.number().integer().min(1).max(100).default(10),
    retryFailed: Joi.boolean().default(true),
    retryAttempts: Joi.number().integer().min(0).max(10).default(3),
    scheduledAt: Joi.date().optional().allow(null),
  }),

  updateCampaign: Joi.object({
    name: Joi.string().optional().min(3).max(255),
    description: Joi.string().optional().allow(''),
    maxConcurrent: Joi.number().integer().min(1).max(100),
    retryFailed: Joi.boolean(),
    retryAttempts: Joi.number().integer().min(0).max(10),
    scheduledAt: Joi.date().optional().allow(null),
    status: Joi.string()
      .valid('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')
      .optional(),
  }),

  // Lead validation
  createLead: Joi.object({
    phoneNumber: Joi.string()
      .required()
      .pattern(/^\+[1-9]\d{1,14}$/)
      .message('Phone number must be in E.164 format (e.g., +1234567890)'),
    name: Joi.string().optional().max(255),
    email: Joi.string().email().optional(),
    priority: Joi.number().integer().min(0).max(10).default(0),
    metadata: Joi.object().optional(),
  }),

  // Agent validation
  createAgent: Joi.object({
    name: Joi.string().required().min(3).max(255),
    livekitTrunkId: Joi.string().required().max(255),
    maxConcurrentCalls: Joi.number().integer().min(1).max(10).default(3),
    status: Joi.string().valid('active', 'inactive').default('active'),
    metadata: Joi.object().optional(),
  }),

  updateAgent: Joi.object({
    name: Joi.string().optional().min(3).max(255),
    livekitTrunkId: Joi.string().optional().max(255),
    maxConcurrentCalls: Joi.number().integer().min(1).max(10),
    status: Joi.string().valid('active', 'inactive', 'busy'),
    metadata: Joi.object().optional(),
  }),

  // Assign agents to campaign
  assignAgents: Joi.object({
    agentIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .required(),
  }),
};

module.exports = {
  validate,
  schemas,
};
