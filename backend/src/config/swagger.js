/**
 * Swagger/OpenAPI Configuration
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Campaign Calling System API',
      version: '1.0.0',
      description: 'API documentation for the Campaign-Based Calling System with LiveKit and Twilio integration',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
      {
        url: 'https://api.production.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Campaign: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'integer',
              description: 'Campaign ID',
            },
            name: {
              type: 'string',
              description: 'Campaign name',
            },
            description: {
              type: 'string',
              description: 'Campaign description',
            },
            status: {
              type: 'string',
              enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'failed'],
              description: 'Campaign status',
            },
            maxConcurrent: {
              type: 'integer',
              description: 'Maximum concurrent calls',
            },
            retryFailed: {
              type: 'boolean',
              description: 'Whether to retry failed calls',
            },
            retryAttempts: {
              type: 'integer',
              description: 'Number of retry attempts',
            },
          },
        },
        Lead: {
          type: 'object',
          required: ['phoneNumber'],
          properties: {
            id: {
              type: 'integer',
              description: 'Lead ID',
            },
            campaignId: {
              type: 'integer',
              description: 'Associated campaign ID',
            },
            phoneNumber: {
              type: 'string',
              description: 'Phone number in E.164 format',
            },
            name: {
              type: 'string',
              description: 'Lead name',
            },
            status: {
              type: 'string',
              enum: ['pending', 'calling', 'answered', 'completed', 'no-answer', 'busy', 'failed'],
              description: 'Lead status',
            },
          },
        },
        Agent: {
          type: 'object',
          required: ['name', 'livekitTrunkId'],
          properties: {
            id: {
              type: 'integer',
              description: 'Agent ID',
            },
            name: {
              type: 'string',
              description: 'Agent name',
            },
            livekitTrunkId: {
              type: 'string',
              description: 'LiveKit SIP trunk ID',
            },
            maxConcurrentCalls: {
              type: 'integer',
              description: 'Maximum concurrent calls for this agent',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'busy'],
              description: 'Agent status',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'object',
              description: 'Error details',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
