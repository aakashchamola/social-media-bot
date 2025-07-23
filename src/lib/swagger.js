const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Social Media Bot API',
      version: '1.0.0',
      description: 'A comprehensive API for social media automation, scheduling, and analytics',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'API Support',
        url: 'https://github.com/aakashchamola/social-media-bot',
        email: 'support@socialmediabot.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.socialmediabot.com',
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
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Post: {
          type: 'object',
          required: ['content', 'platform', 'scheduledTime'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the post',
            },
            content: {
              type: 'string',
              description: 'Content of the post',
              maxLength: 280,
            },
            platform: {
              type: 'string',
              enum: ['twitter'],
              description: 'Target social media platform',
            },
            scheduledTime: {
              type: 'string',
              format: 'date-time',
              description: 'When the post should be published',
            },
            posted: {
              type: 'boolean',
              description: 'Whether the post has been published',
              default: false,
            },
            postId: {
              type: 'string',
              description: 'Platform-specific post ID after publishing',
            },
            mediaUrls: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description: 'URLs of media attachments',
            },
            hashtags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Hashtags associated with the post',
            },
            metadata: {
              type: 'object',
              properties: {
                likes: { type: 'integer' },
                retweets: { type: 'integer' },
                replies: { type: 'integer' },
                shares: { type: 'integer' },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Task: {
          type: 'object',
          required: ['type', 'platform', 'target', 'action'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the task',
            },
            type: {
              type: 'string',
              enum: ['like', 'comment', 'follow', 'retweet', 'scrape', 'trend_monitor'],
              description: 'Type of task to perform',
            },
            platform: {
              type: 'string',
              enum: ['twitter'],
              description: 'Target social media platform',
            },
            target: {
              type: 'string',
              description: 'Target for the task (username, post ID, hashtag, etc.)',
            },
            action: {
              type: 'string',
              description: 'Specific action to perform',
            },
            status: {
              type: 'string',
              enum: ['pending', 'scheduled', 'completed', 'failed'],
              description: 'Current status of the task',
              default: 'pending',
            },
            scheduledTime: {
              type: 'string',
              format: 'date-time',
              description: 'When the task should be executed',
            },
            executedTime: {
              type: 'string',
              format: 'date-time',
              description: 'When the task was actually executed',
            },
            priority: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Task priority (1-5, where 5 is highest)',
              default: 3,
            },
            result: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                data: { type: 'object' },
              },
            },
          },
        },
        User: {
          type: 'object',
          required: ['username', 'platform'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the user',
            },
            username: {
              type: 'string',
              description: 'Username on the social media platform',
            },
            platform: {
              type: 'string',
              enum: ['twitter'],
              description: 'Social media platform',
            },
            userId: {
              type: 'string',
              description: 'Platform-specific user ID',
            },
            followers: {
              type: 'integer',
              description: 'Number of followers',
              minimum: 0,
            },
            verified: {
              type: 'boolean',
              description: 'Whether the user is verified on the platform',
              default: false,
            },
            interactionHistory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  success: { type: 'boolean' },
                },
              },
            },
            metrics: {
              type: 'object',
              properties: {
                totalInteractions: { type: 'integer' },
                successfulInteractions: { type: 'integer' },
                lastEngagementRate: { type: 'number', format: 'float' },
              },
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
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Detailed error description',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Too many requests - Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      retryAfter: {
                        type: 'integer',
                        description: 'Seconds to wait before retrying',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
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
    tags: [
      {
        name: 'Health',
        description: 'Health check and system status endpoints',
      },
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Posts',
        description: 'Social media post scheduling and management',
      },
      {
        name: 'Tasks',
        description: 'Automated interaction tasks',
      },
      {
        name: 'Users',
        description: 'Social media user management',
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting endpoints',
      },
      {
        name: 'Rate Limits',
        description: 'Rate limiting information',
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/api/rest/*.js',
    './src/app.js',
  ],
};

const specs = swaggerJsdoc(options);

const swaggerConfig = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info hgroup.main h2 { color: #3b82f6 }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 5px }
  `,
  customSiteTitle: 'Social Media Bot API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
    displayOperationId: false,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
  },
};

module.exports = {
  specs,
  swaggerUi,
  swaggerConfig,
  setup: (app) => {
    // Serve API documentation
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerConfig));
    
    // Serve OpenAPI spec as JSON
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    console.log('📚 API Documentation available at /api-docs');
  },
};
