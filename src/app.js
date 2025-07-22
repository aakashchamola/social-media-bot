const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
require('dotenv').config();

// Import custom middleware and utilities
const logger = require('./lib/logger');
const authService = require('./lib/auth');
const rateLimitManager = require('./lib/rateLimiter');
const { setup: setupSwagger } = require('./lib/swagger');
const GraphQLServer = require('./api/graphql/server');

// Import routes
const scheduleRoutes = require('./routes/scheduleRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const interactionRoutes = require('./routes/interactionRoutes');

// Import schedulers
const { initializeSchedulers } = require('./controllers/scheduler');

// Import database connection
const connectDB = require('./db/connect');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Request logging middleware
app.use(logger.getRequestLogger());

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
app.use(rateLimitManager.createExpressLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900
  }
}));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// API Routes with rate limiting
app.use('/api/schedule', rateLimitManager.createUserLimiter(50, 3600), scheduleRoutes);
app.use('/api/users', rateLimitManager.createUserLimiter(100, 3600), userRoutes);
app.use('/api/analytics', rateLimitManager.createUserLimiter(30, 3600), analyticsRoutes);
app.use('/api/interact', rateLimitManager.createPlatformLimiter(), interactionRoutes);

// Rate limit info endpoint
app.get('/api/rate-limits', rateLimitManager.getRateLimitInfo());

// Setup API documentation
setupSwagger(app);

// Placeholder for GraphQL middleware - will be set up asynchronously
let graphqlMiddleware = null;

// Health check route
/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Social Media Bot Server is running!
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 environment:
 *                   type: string
 *                   example: development
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Social Media Bot Server is running!',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api-docs',
    graphql: '/graphql'
  });
});

// GraphQL endpoint - handled dynamically after server initialization
app.use('/graphql', (req, res, next) => {
  if (graphqlMiddleware) {
    return graphqlMiddleware(req, res, next);
  } else {
    return res.status(503).json({
      success: false,
      error: 'GraphQL server is still initializing',
      message: 'Please try again in a moment'
    });
  }
});

// Error handling middleware
app.use(logger.getErrorLogger());

app.use((err, req, res, next) => {
  logger.error('Unhandled error', err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(err.status || 500).json({
    success: false,
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      health: '/',
      api: '/api',
      documentation: '/api-docs',
      graphql: '/graphql'
    }
  });
});

// Start server
const startServer = async () => {
  try {
    logger.info('🚀 Starting Social Media Bot Server...');
    
    // Connect to MongoDB
    await connectDB();
    logger.dbLogger.info('Database connection established');
    
    // Initialize GraphQL server
    const graphqlServer = new GraphQLServer();
    await graphqlServer.createServer(httpServer);
    
    // Set GraphQL middleware
    graphqlMiddleware = graphqlServer.getMiddleware();
    
    // Initialize schedulers
    initializeSchedulers();
    logger.schedulerLogger.info('All schedulers initialized');
    
    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Social Media Bot Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        documentation: `http://localhost:${PORT}/api-docs`,
        graphql: `http://localhost:${PORT}/graphql`,
        health: `http://localhost:${PORT}/`
      });
      
      console.log(`🚀 Social Media Bot Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔗 GraphQL Playground: http://localhost:${PORT}/graphql`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      httpServer.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await mongoose.connection.close();
          logger.info('Database connection closed');
          
          await logger.close();
          
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('❌ Failed to start server', error);
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
