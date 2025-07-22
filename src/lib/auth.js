const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    this.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  // Generate JWT token
  generateToken(payload) {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
      issuer: 'social-media-bot',
      audience: 'social-media-bot-users'
    });
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'social-media-bot',
      audience: 'social-media-bot-users'
    });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET, {
        issuer: 'social-media-bot',
        audience: 'social-media-bot-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Extract token from Authorization header
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  // Middleware to authenticate JWT token
  authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = this.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    try {
      const decoded = this.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
  };

  // Middleware to optionally authenticate (doesn't fail if no token)
  optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = this.extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const decoded = this.verifyToken(token);
        req.user = decoded;
      } catch (error) {
        // Don't fail, just continue without user
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  };

  // Create user session
  createUserSession(user) {
    const payload = {
      id: user.id || user._id,
      username: user.username,
      role: user.role || 'user',
      permissions: user.permissions || ['read']
    };

    const accessToken = this.generateToken(payload);
    const refreshToken = this.generateRefreshToken({ id: payload.id });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.JWT_EXPIRES_IN,
      tokenType: 'Bearer',
      user: {
        id: payload.id,
        username: payload.username,
        role: payload.role,
        permissions: payload.permissions
      }
    };
  }

  // Refresh access token
  refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      // Create new access token with same payload structure
      const newPayload = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'user',
        permissions: decoded.permissions || ['read']
      };

      const newAccessToken = this.generateToken(newPayload);

      return {
        accessToken: newAccessToken,
        expiresIn: this.JWT_EXPIRES_IN,
        tokenType: 'Bearer'
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Check if user has required permission
  hasPermission(user, requiredPermission) {
    if (!user || !user.permissions) {
      return false;
    }

    // Admin role has all permissions
    if (user.role === 'admin') {
      return true;
    }

    return user.permissions.includes(requiredPermission);
  }

  // Permission middleware
  requirePermission = (permission) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!this.hasPermission(req.user, permission)) {
        return res.status(403).json({
          success: false,
          message: `Permission '${permission}' required`
        });
      }

      next();
    };
  };

  // Admin middleware
  requireAdmin = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin role required'
      });
    }

    next();
  };
}

module.exports = new AuthService();
