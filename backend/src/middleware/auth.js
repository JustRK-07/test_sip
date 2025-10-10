const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Extract public key from X.509 certificate
 * @param {string} certificate - The X.509 certificate in PEM format
 * @returns {string} - The extracted public key in PEM format
 */
const extractPublicKeyFromCertificate = (certificate) => {
  try {
    // Check if it's already a public key (for backward compatibility)
    if (certificate.includes('-----BEGIN PUBLIC KEY-----')) {
      return certificate;
    }
    
    // If it's a certificate, extract the public key
    if (certificate.includes('-----BEGIN CERTIFICATE-----')) {
      const cert = crypto.createPublicKey(certificate);
      return cert.export({ type: 'spki', format: 'pem' });
    }
    
    throw new Error('Invalid certificate or public key format');
  } catch (error) {
    console.error('Error extracting public key from certificate:', error.message);
    throw error;
  }
};

/**
 * JWT Authentication Middleware
 * Validates JWT tokens using the public key extracted from certificate in environment variables
 */
const authenticateToken = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      }
    });
  }

  // Get certificate/public key from environment
  const certificate = process.env.JWT_PUBLIC_KEY;
  
  if (!certificate) {
    console.error('JWT_PUBLIC_KEY not configured');
    return res.status(500).json({
      error: {
        message: 'JWT configuration error',
        code: 'CONFIG_ERROR'
      }
    });
  }

  try {
    // Extract public key from certificate or use public key directly
    const publicKey = extractPublicKeyFromCertificate(certificate);
    
    // Verify token with public key
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'] // Assuming RSA public key signature
    });

    // Add user info to request object
    req.user = {
      ...decoded // Include any additional claims
    };

    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    
    let errorMessage = 'Invalid token';
    let errorCode = 'INVALID_TOKEN';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Malformed token';
      errorCode = 'MALFORMED_TOKEN';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'Token not active';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }

    return res.status(401).json({
      error: {
        message: errorMessage,
        code: errorCode
      }
    });
  }
};

/**
 * Optional authentication middleware
 * Validates token if present but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  // Use the same logic as authenticateToken but don't fail on missing token
  const certificate = process.env.JWT_PUBLIC_KEY;
  
  if (!certificate) {
    req.user = null;
    return next();
  }

  try {
    // Extract public key from certificate or use public key directly
    const publicKey = extractPublicKeyFromCertificate(certificate);
    
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    });

    req.user = {
      id: decoded.sub || decoded.user_id || decoded.id,
      email: decoded.email,
      name: decoded.name,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      tenantId: decoded.tenant_id || decoded.tenantId,
      ...decoded
    };
  } catch (error) {
    console.warn('Optional JWT verification failed:', error.message);
    req.user = null;
  }

  next();
};

/**
 * Role-based access control middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: userRoles
        }
      });
    }

    next();
  };
};

/**
 * Account-based access control middleware
 * Restricts access to a specific account ID from JWT token
 * Admin users (with system admin account ID) can access all tenants
 */
const requireAccount = (allowedAccountId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }

    const userAccountId = req.user.acct;
    const SYSTEM_ADMIN_ACCOUNT_ID = '00000000-0000-0000-0000-00000000b40d';

    if (!userAccountId) {
      return res.status(403).json({
        error: {
          message: 'Account information missing from token',
          code: 'MISSING_ACCOUNT_INFO'
        }
      });
    }

    // Allow system admins to access any tenant
    if (userAccountId === SYSTEM_ADMIN_ACCOUNT_ID) {
      return next();
    }

    // Regular users must match the tenant ID
    if (userAccountId !== allowedAccountId) {
      return res.status(403).json({
        error: {
          message: 'Access denied: Account ID does not match tenant ID',
          code: 'TENANT_ACCESS_DENIED',
          required: allowedAccountId,
          current: userAccountId
        }
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireAccount
};