/**
 * Authentication Routes
 * POST /api/v1/auth/register - Register new user
 * POST /api/v1/auth/login - Login and get JWT token
 * GET /api/v1/auth/me - Get current user info
 * POST /api/v1/auth/change-password - Change password
 */

const express = require('express');
const authService = require('../services/AuthService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public (but should be restricted in production)
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, isAdmin, tenantId } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          message: 'Invalid email format',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: {
          message: 'Password must be at least 6 characters long',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const result = await authService.register({
      email,
      password,
      name,
      isAdmin: isAdmin === true,
      tenantId
    });

    res.status(201).json({
      success: true,
      data: result.user,
      message: result.message
    });
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('not found')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'CONFLICT'
        }
      });
    }

    if (error.message.includes('required') || error.message.includes('cannot')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to register user',
        code: 'REGISTER_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * @route POST /api/v1/auth/login
 * @desc Login and get JWT token
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const result = await authService.login({ email, password });

    res.json({
      success: true,
      data: {
        token: result.token,
        tokenType: 'Bearer',
        user: result.user
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    if (error.message.includes('deactivated')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'ACCOUNT_DEACTIVATED'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to login',
        code: 'LOGIN_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user info
 * @access Protected
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.sub);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to get user info',
        code: 'GET_USER_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * @route POST /api/v1/auth/change-password
 * @desc Change user password
 * @access Protected
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Old password and new password are required',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: {
          message: 'New password must be at least 6 characters long',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const result = await authService.changePassword(
      req.user.sub,
      oldPassword,
      newPassword
    );

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    if (error.message.includes('incorrect')) {
      return res.status(401).json({
        error: {
          message: error.message,
          code: 'INVALID_PASSWORD'
        }
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to change password',
        code: 'CHANGE_PASSWORD_ERROR',
        details: error.message
      }
    });
  }
});

module.exports = router;
