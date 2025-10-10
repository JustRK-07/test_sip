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
        Tenant: {
          type: 'object',
          required: ['name', 'domain'],
          properties: {
            id: {
              type: 'string',
              description: 'Tenant ID (CUID)',
            },
            name: {
              type: 'string',
              description: 'Tenant name',
            },
            domain: {
              type: 'string',
              description: 'Tenant domain',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether tenant is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Campaign: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'string',
              description: 'Campaign ID (CUID)',
            },
            name: {
              type: 'string',
              description: 'Campaign name',
            },
            description: {
              type: 'string',
              description: 'Campaign description',
            },
            type: {
              type: 'string',
              enum: ['OUTBOUND', 'INBOUND'],
              description: 'Campaign type',
            },
            status: {
              type: 'string',
              enum: ['IDLE', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED'],
              description: 'Campaign status',
            },
            sipTrunkId: {
              type: 'string',
              description: 'LiveKit SIP trunk ID',
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
            callDelay: {
              type: 'integer',
              description: 'Delay between calls in milliseconds',
            },
            tenantId: {
              type: 'string',
              description: 'Associated tenant ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
        },
        Lead: {
          type: 'object',
          required: ['phoneNumber'],
          properties: {
            id: {
              type: 'string',
              description: 'Lead ID (CUID)',
            },
            campaignId: {
              type: 'string',
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
            email: {
              type: 'string',
              description: 'Lead email',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'CALLING', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY'],
              description: 'Lead status',
            },
            priority: {
              type: 'integer',
              description: 'Lead priority (1-10)',
            },
            attempts: {
              type: 'integer',
              description: 'Number of call attempts',
            },
          },
        },
        Agent: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'string',
              description: 'Agent ID (CUID)',
            },
            name: {
              type: 'string',
              description: 'Agent display name',
            },
            livekitAgentName: {
              type: 'string',
              description: 'LiveKit worker agent name',
            },
            description: {
              type: 'string',
              description: 'Agent description',
            },
            type: {
              type: 'string',
              enum: ['VOICE', 'CHAT', 'HYBRID'],
              description: 'Agent type',
            },
            model: {
              type: 'string',
              description: 'LLM model name',
            },
            voice: {
              type: 'string',
              description: 'Voice ID',
            },
            language: {
              type: 'string',
              description: 'Language code (e.g., en-US)',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether agent is active',
            },
            maxConcurrentCalls: {
              type: 'integer',
              description: 'Maximum concurrent calls for this agent',
            },
            tenantId: {
              type: 'string',
              description: 'Associated tenant ID',
            },
          },
        },
        PhoneNumber: {
          type: 'object',
          required: ['number'],
          properties: {
            id: {
              type: 'string',
              description: 'Phone number ID (CUID)',
            },
            number: {
              type: 'string',
              description: 'Phone number in E.164 format',
            },
            friendlyName: {
              type: 'string',
              description: 'Friendly display name',
            },
            type: {
              type: 'string',
              enum: ['LOCAL', 'TOLL_FREE', 'MOBILE'],
              description: 'Phone number type',
            },
            provider: {
              type: 'string',
              enum: ['TWILIO'],
              description: 'Service provider',
            },
            providerSid: {
              type: 'string',
              description: 'Provider SID (e.g., Twilio PN SID)',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether number is active',
            },
            tenantId: {
              type: 'string',
              description: 'Associated tenant ID',
            },
            campaignId: {
              type: 'string',
              description: 'Associated campaign ID',
            },
            livekitTrunkId: {
              type: 'string',
              description: 'Associated LiveKit trunk ID',
            },
            platformTrunkId: {
              type: 'string',
              description: 'Associated platform trunk ID',
            },
          },
        },
        PhoneNumberInput: {
          type: 'object',
          required: ['number'],
          properties: {
            number: {
              type: 'string',
              description: 'Phone number to purchase (E.164 format)',
              example: '+15551234567',
            },
            type: {
              type: 'string',
              enum: ['LOCAL', 'TOLL_FREE', 'MOBILE'],
              description: 'Phone number type',
              default: 'LOCAL',
            },
            label: {
              type: 'string',
              description: 'Friendly label for the number',
              example: 'Main Office Line',
            },
            provider: {
              type: 'string',
              enum: ['TWILIO'],
              description: 'Service provider',
              default: 'TWILIO',
            },
            campaignId: {
              type: 'string',
              description: 'Campaign ID to associate with (optional)',
            },
          },
        },
        AvailablePhoneNumber: {
          type: 'object',
          properties: {
            phoneNumber: {
              type: 'string',
              description: 'Available phone number',
            },
            friendlyName: {
              type: 'string',
              description: 'Formatted display name',
            },
            locality: {
              type: 'string',
              description: 'City/locality',
            },
            region: {
              type: 'string',
              description: 'State/region',
            },
            postalCode: {
              type: 'string',
              description: 'Postal/ZIP code',
            },
            country: {
              type: 'string',
              description: 'Country code',
            },
            capabilities: {
              type: 'object',
              properties: {
                voice: { type: 'boolean' },
                sms: { type: 'boolean' },
                mms: { type: 'boolean' },
              },
            },
          },
        },
        PlatformTrunk: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'string',
              description: 'Platform trunk ID',
            },
            name: {
              type: 'string',
              description: 'Trunk name',
            },
            description: {
              type: 'string',
              description: 'Trunk description',
            },
            twilioTrunkSid: {
              type: 'string',
              description: 'Twilio elastic SIP trunk SID',
            },
            twilioRegion: {
              type: 'string',
              description: 'Twilio region',
            },
            maxChannels: {
              type: 'integer',
              description: 'Maximum concurrent channels',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether trunk is active',
            },
          },
        },
        LiveKitTrunk: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'string',
              description: 'LiveKit trunk ID',
            },
            name: {
              type: 'string',
              description: 'Trunk name',
            },
            description: {
              type: 'string',
              description: 'Trunk description',
            },
            livekitTrunkId: {
              type: 'string',
              description: 'LiveKit SIP trunk ID (e.g., ST_xxx)',
            },
            trunkType: {
              type: 'string',
              enum: ['INBOUND', 'OUTBOUND'],
              description: 'Trunk type',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'PROVISIONING', 'ERROR', 'MAINTENANCE'],
              description: 'Trunk status',
            },
            tenantId: {
              type: 'string',
              description: 'Associated tenant ID',
            },
            platformTrunkId: {
              type: 'string',
              description: 'Associated platform trunk ID',
            },
            maxConcurrentCalls: {
              type: 'integer',
              description: 'Maximum concurrent calls',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number',
            },
            limit: {
              type: 'integer',
              description: 'Items per page',
            },
            totalCount: {
              type: 'integer',
              description: 'Total number of items',
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
            },
            hasNext: {
              type: 'boolean',
              description: 'Whether there is a next page',
            },
            hasPrevious: {
              type: 'boolean',
              description: 'Whether there is a previous page',
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
      responses: {
        UnauthorizedError: {
          description: 'Unauthorized - Invalid or missing authentication token',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        example: 'Unauthorized',
                      },
                      code: {
                        type: 'string',
                        example: 'UNAUTHORIZED',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        example: 'Forbidden - You do not have permission to access this resource',
                      },
                      code: {
                        type: 'string',
                        example: 'FORBIDDEN',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        NotFoundError: {
          description: 'Not Found - The requested resource was not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        example: 'Resource not found',
                      },
                      code: {
                        type: 'string',
                        example: 'NOT_FOUND',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        BadRequestError: {
          description: 'Bad Request - Invalid input data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        example: 'Invalid request data',
                      },
                      code: {
                        type: 'string',
                        example: 'BAD_REQUEST',
                      },
                      details: {
                        type: 'array',
                        items: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal Server Error - Something went wrong on the server',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        example: 'Internal server error',
                      },
                      code: {
                        type: 'string',
                        example: 'INTERNAL_SERVER_ERROR',
                      },
                    },
                  },
                },
              },
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
