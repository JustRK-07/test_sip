/**
 * Authentication Service
 * Handles user registration, login, and JWT token generation
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPrismaClient } = require('../config/prisma');
const logger = require('../utils/logger');

const prisma = getPrismaClient();

// System admin account ID
const SYSTEM_ADMIN_ACCOUNT_ID = '00000000-0000-0000-0000-00000000b40d';

class AuthService {
  /**
   * Register a new user
   */
  async register({ email, password, name, isAdmin = false, tenantId = null }) {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (!isAdmin && !tenantId) {
        throw new Error('Regular users must be associated with a tenant');
      }

      if (isAdmin && tenantId) {
        throw new Error('Admin users cannot be associated with a specific tenant');
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // If tenantId provided, verify tenant exists
      if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId }
        });

        if (!tenant) {
          throw new Error('Tenant not found');
        }

        if (!tenant.isActive) {
          throw new Error('Tenant is not active');
        }
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          isAdmin,
          tenantId,
          isActive: true
        },
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          tenantId: true,
          isActive: true,
          createdAt: true
        }
      });

      logger.info(`User registered: ${email} (Admin: ${isAdmin})`);

      return {
        user,
        message: 'User registered successfully'
      };
    } catch (error) {
      logger.error('Error in register:', error);
      throw error;
    }
  }

  /**
   * Login user and generate JWT token
   */
  async login({ email, password }) {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              isActive: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      if (!user.isActive) {
        throw new Error('User account is deactivated');
      }

      // Check tenant status for regular users
      if (!user.isAdmin && user.tenant && !user.tenant.isActive) {
        throw new Error('Tenant account is deactivated');
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.passwordHash);

      if (!validPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Generate JWT token
      const token = this.generateToken(user);

      logger.info(`User logged in: ${email} (Admin: ${user.isAdmin})`);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          tenantId: user.tenantId,
          tenant: user.tenant
        }
      };
    } catch (error) {
      logger.error('Error in login:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user) {
    const privateKey = process.env.JWT_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('JWT_PRIVATE_KEY not configured');
    }

    // Determine account ID based on user type
    const accountId = user.isAdmin ? SYSTEM_ADMIN_ACCOUNT_ID : user.tenantId;

    if (!accountId) {
      throw new Error('Cannot generate token: No account ID available');
    }

    // Build JWT payload
    const payload = {
      sub: user.id,
      acct: accountId,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      tenantId: user.tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      iss: 'campaign-calling-system',
      aud: 'campaign-calling-api'
    };

    // Sign token with RS256 or HS256 based on key type
    const algorithm = privateKey.includes('BEGIN RSA PRIVATE KEY') || privateKey.includes('BEGIN PRIVATE KEY')
      ? 'RS256'
      : 'HS256';

    const token = jwt.sign(payload, privateKey, { algorithm });

    return token;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          tenantId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              domain: true,
              isActive: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Error in getUserById:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify old password
      const validPassword = await bcrypt.compare(oldPassword, user.passwordHash);

      if (!validPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      });

      logger.info(`Password changed for user: ${user.email}`);

      return {
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Error in changePassword:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
