const rateLimit = require('express-rate-limit');
const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const logger = require('./logger');

class RateLimitManager {
  constructor() {
    this.limiters = new Map();
    this.initializeLimiters();
  }

  initiali        platform: {
          twitter: this.getPlatformLimits('twitter')
        },iters() {
    // Global API rate limiter
    this.limiters.set('global', new RateLimiterMemory({
      keyGenerator: (req) => req.ip,
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
    }));

    // Authentication rate limiter
    this.limiters.set('auth', new RateLimiterMemory({
      keyGenerator: (req) => req.ip,
      points: 5, // 5 attempts
      duration: 900, // Per 15 minutes
      blockDuration: 900, // Block for 15 minutes
    }));

    // API key rate limiter
    this.limiters.set('api-key', new RateLimiterMemory({
      keyGenerator: (req) => req.get('X-API-Key') || req.ip,
      points: 1000, // 1000 requests
      duration: 3600, // Per hour
    }));

    // User-specific rate limiter
    this.limiters.set('user', new RateLimiterMemory({
      keyGenerator: (req) => req.user?.id || req.ip,
      points: 200, // 200 requests
      duration: 3600, // Per hour
    }));

    // Social media action rate limiter
    this.limiters.set('social-action', new RateLimiterMemory({
      keyGenerator: (req) => `${req.user?.id || req.ip}:${req.body.platform}`,
      points: 30, // 30 actions
      duration: 3600, // Per hour
    }));

    // Bulk operation rate limiter
    this.limiters.set('bulk', new RateLimiterMemory({
      keyGenerator: (req) => req.user?.id || req.ip,
      points: 5, // 5 bulk operations
      duration: 3600, // Per hour
    }));

    console.log('✅ Rate limiters initialized');
  }

  // Create Express rate limiter middleware
  createExpressLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000) || 900
      },
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          method: req.method,
          url: req.originalUrl,
          userAgent: req.get('User-Agent')
        });
        
        res.status(429).json(options.message || defaultOptions.message);
      },
      ...options
    };

    return rateLimit(defaultOptions);
  }

  // Flexible rate limiter middleware
  createFlexibleLimiter(limiterName) {
    const limiter = this.limiters.get(limiterName);
    
    if (!limiter) {
      throw new Error(`Rate limiter '${limiterName}' not found`);
    }

    return async (req, res, next) => {
      try {
        await limiter.consume(req.ip);
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        logger.warn('Flexible rate limit exceeded', {
          limiter: limiterName,
          ip: req.ip,
          method: req.method,
          url: req.originalUrl,
          retryAfter: secs
        });

        res.set('Retry-After', String(secs));
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: secs,
          limiter: limiterName
        });
      }
    };
  }

  // Custom rate limiter for authenticated users
  createUserLimiter(points = 200, duration = 3600) {
    return async (req, res, next) => {
      const key = req.user?.id || req.ip;
      const limiter = new RateLimiterMemory({
        keyGenerator: () => key,
        points,
        duration,
      });

      try {
        const result = await limiter.consume(key);
        
        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': points,
          'X-RateLimit-Remaining': result.remainingPoints,
          'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext)
        });
        
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        logger.warn('User rate limit exceeded', {
          userId: req.user?.id,
          ip: req.ip,
          method: req.method,
          url: req.originalUrl,
          retryAfter: secs
        });

        res.set('Retry-After', String(secs));
        res.status(429).json({
          success: false,
          error: 'User rate limit exceeded',
          retryAfter: secs
        });
      }
    };
  }

  // Platform-specific rate limiter for social media actions
  createPlatformLimiter() {
    return async (req, res, next) => {
      const platform = req.body.platform || req.params.platform;
      const userId = req.user?.id || req.ip;
      const key = `${userId}:${platform}`;

      // Get platform-specific limits
      const limits = this.getPlatformLimits(platform);
      
      const limiter = new RateLimiterMemory({
        keyGenerator: () => key,
        points: limits.points,
        duration: limits.duration,
      });

      try {
        const result = await limiter.consume(key);
        
        res.set({
          'X-Platform-RateLimit-Limit': limits.points,
          'X-Platform-RateLimit-Remaining': result.remainingPoints,
          'X-Platform-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext)
        });
        
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        logger.warn('Platform rate limit exceeded', {
          platform,
          userId: req.user?.id,
          ip: req.ip,
          retryAfter: secs
        });

        res.set('Retry-After', String(secs));
        res.status(429).json({
          success: false,
          error: `${platform} rate limit exceeded`,
          retryAfter: secs,
          platform
        });
      }
    };
  }

  // Get platform-specific rate limits
  getPlatformLimits(platform) {
    const limits = {
      twitter: {
        points: parseInt(process.env.TWITTER_RATE_LIMIT_REQUESTS) || 300,
        duration: (parseInt(process.env.TWITTER_RATE_LIMIT_WINDOW) || 15) * 60
      }
    };

    return limits[platform] || { points: 50, duration: 3600 };
  }

  // Adaptive rate limiter that adjusts based on server load
  createAdaptiveLimiter(basePoints = 100) {
    return async (req, res, next) => {
      // Simple load calculation (can be enhanced with actual system metrics)
      const memUsage = process.memoryUsage();
      const loadFactor = memUsage.heapUsed / memUsage.heapTotal;
      
      // Reduce rate limit if system is under high load
      const adjustedPoints = loadFactor > 0.8 ? 
        Math.floor(basePoints * 0.5) : basePoints;

      const limiter = new RateLimiterMemory({
        keyGenerator: (req) => req.ip,
        points: adjustedPoints,
        duration: 60,
      });

      try {
        await limiter.consume(req.ip);
        res.set('X-Adaptive-Limit', adjustedPoints);
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        logger.warn('Adaptive rate limit exceeded', {
          ip: req.ip,
          loadFactor,
          adjustedPoints,
          retryAfter: secs
        });

        res.set('Retry-After', String(secs));
        res.status(429).json({
          success: false,
          error: 'System under high load, please try again later',
          retryAfter: secs
        });
      }
    };
  }

  // IP whitelist bypass
  createWhitelistBypass(whitelist = []) {
    return (req, res, next) => {
      if (whitelist.includes(req.ip)) {
        logger.debug('Rate limit bypassed for whitelisted IP', { ip: req.ip });
        next();
      } else {
        // Continue to next middleware (rate limiter)
        next();
      }
    };
  }

  // Rate limit information endpoint
  getRateLimitInfo() {
    return async (req, res) => {
      const info = {
        global: {
          limit: 100,
          window: '1 minute',
          description: 'Global API rate limit'
        },
        authenticated: {
          limit: 200,
          window: '1 hour',
          description: 'Authenticated user rate limit'
        },
        platforms: {
          twitter: this.getPlatformLimits('twitter')
        },
        special: {
          auth: { limit: 5, window: '15 minutes', description: 'Authentication attempts' },
          bulk: { limit: 5, window: '1 hour', description: 'Bulk operations' }
        }
      };

      res.json({
        success: true,
        rateLimits: info,
        timestamp: new Date().toISOString()
      });
    };
  }
}

// Create singleton instance
const rateLimitManager = new RateLimitManager();

module.exports = rateLimitManager;
