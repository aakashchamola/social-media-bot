const winston = require('winston');
const path = require('path');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}] ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

class Logger {
  constructor() {
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      defaultMeta: {
        service: 'social-media-bot',
        version: process.env.npm_package_version || '1.0.0'
      },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: consoleFormat,
          level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
        }),

        // Error log file
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          format: fileFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),

        // Combined log file
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log'),
          format: fileFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 10
        }),

        // Application events log
        new winston.transports.File({
          filename: path.join(logsDir, 'app.log'),
          level: 'info',
          format: fileFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 7
        })
      ],
      
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log'),
          format: fileFormat
        })
      ],
      
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log'),
          format: fileFormat
        })
      ]
    });

    // Create separate loggers for different components
    this.apiLogger = this.createChildLogger('api');
    this.dbLogger = this.createChildLogger('database');
    this.taskLogger = this.createChildLogger('tasks');
    this.socialLogger = this.createChildLogger('social-media');
    this.authLogger = this.createChildLogger('auth');
    this.schedulerLogger = this.createChildLogger('scheduler');
  }

  createChildLogger(component) {
    return this.winston.child({ component });
  }

  // General logging methods
  debug(message, meta = {}) {
    this.winston.debug(message, meta);
  }

  info(message, meta = {}) {
    this.winston.info(message, meta);
  }

  warn(message, meta = {}) {
    this.winston.warn(message, meta);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = { ...meta };
    
    if (error) {
      if (error instanceof Error) {
        errorMeta.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      } else {
        errorMeta.error = error;
      }
    }
    
    this.winston.error(message, errorMeta);
  }

  // API logging methods
  logApiRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id
    };

    if (res.statusCode >= 400) {
      this.apiLogger.error('API Error Response', logData);
    } else {
      this.apiLogger.info('API Request', logData);
    }
  }

  logApiError(req, error) {
    this.apiLogger.error('API Error', {
      method: req.method,
      url: req.originalUrl,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userId: req.user?.id,
      ip: req.ip
    });
  }

  // Database logging methods
  logDbConnection(status, details = {}) {
    if (status === 'connected') {
      this.dbLogger.info('Database connected', details);
    } else if (status === 'error') {
      this.dbLogger.error('Database connection error', details);
    } else if (status === 'disconnected') {
      this.dbLogger.warn('Database disconnected', details);
    }
  }

  logDbQuery(collection, operation, duration, error = null) {
    const logData = {
      collection,
      operation,
      duration: `${duration}ms`
    };

    if (error) {
      this.dbLogger.error('Database query error', { ...logData, error });
    } else if (duration > 1000) {
      this.dbLogger.warn('Slow database query', logData);
    } else {
      this.dbLogger.debug('Database query', logData);
    }
  }

  // Task logging methods
  logTaskExecution(task, result, duration) {
    const logData = {
      taskId: task.id || task._id,
      type: task.type,
      platform: task.platform,
      target: task.target,
      duration: `${duration}ms`,
      success: result.success
    };

    if (result.success) {
      this.taskLogger.info('Task executed successfully', logData);
    } else {
      this.taskLogger.error('Task execution failed', { 
        ...logData, 
        error: result.message || result.error 
      });
    }
  }

  logTaskScheduled(task) {
    this.taskLogger.info('Task scheduled', {
      taskId: task.id || task._id,
      type: task.type,
      platform: task.platform,
      scheduledTime: task.scheduledTime
    });
  }

  // Social media logging methods
  logSocialMediaAction(platform, action, target, result) {
    const logData = {
      platform,
      action,
      target,
      success: result.success,
      timestamp: new Date().toISOString()
    };

    if (result.success) {
      this.socialLogger.info(`${platform} ${action} successful`, logData);
    } else {
      this.socialLogger.error(`${platform} ${action} failed`, {
        ...logData,
        error: result.error || result.message
      });
    }
  }

  logRateLimit(platform, action, remaining) {
    this.socialLogger.warn('Rate limit approached', {
      platform,
      action,
      remaining,
      timestamp: new Date().toISOString()
    });
  }

  // Authentication logging methods
  logAuthAttempt(username, success, ip, reason = null) {
    const logData = {
      username,
      success,
      ip,
      timestamp: new Date().toISOString()
    };

    if (reason) {
      logData.reason = reason;
    }

    if (success) {
      this.authLogger.info('Authentication successful', logData);
    } else {
      this.authLogger.warn('Authentication failed', logData);
    }
  }

  logTokenGeneration(userId, tokenType) {
    this.authLogger.info('Token generated', {
      userId,
      tokenType,
      timestamp: new Date().toISOString()
    });
  }

  // Scheduler logging methods
  logSchedulerEvent(event, details = {}) {
    this.schedulerLogger.info(`Scheduler: ${event}`, {
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  logSchedulerError(event, error) {
    this.schedulerLogger.error(`Scheduler error: ${event}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });
  }

  // Performance logging
  logPerformance(operation, duration, details = {}) {
    const logData = {
      operation,
      duration: `${duration}ms`,
      ...details
    };

    if (duration > 5000) {
      this.winston.warn('Slow operation detected', logData);
    } else if (duration > 1000) {
      this.winston.info('Operation completed', logData);
    } else {
      this.winston.debug('Operation completed', logData);
    }
  }

  // Express middleware for request logging
  getRequestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logApiRequest(req, res, responseTime);
      });

      next();
    };
  }

  // Express error logging middleware
  getErrorLogger() {
    return (error, req, res, next) => {
      this.logApiError(req, error);
      next(error);
    };
  }

  // Graceful shutdown
  async close() {
    return new Promise((resolve) => {
      this.winston.end(() => {
        resolve();
      });
    });
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
