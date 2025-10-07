/**
 * Express Application Setup (Production-Ready)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const logger = require('./utils/logger');
const swaggerSpec = require('./config/swagger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Create Express app
const app = express();

// ==============================================
// SECURITY MIDDLEWARE
// ==============================================

// Helmet - Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for Swagger UI
  })
);

// CORS - Cross-Origin Resource Sharing
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ==============================================
// BODY PARSING MIDDLEWARE
// ==============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==============================================
// LOGGING MIDDLEWARE
// ==============================================

// Morgan HTTP request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

// ==============================================
// COMPRESSION
// ==============================================

app.use(compression());

// ==============================================
// API DOCUMENTATION (SWAGGER)
// ==============================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Campaign Calling API Docs',
}));

// ==============================================
// HEALTH CHECK
// ==============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ==============================================
// API ROUTES
// ==============================================

const apiPrefix = process.env.API_PREFIX || '/api/v1';

// Import routes
const routes = require('./routes');

// Mount routes
app.use(apiPrefix, routes);

// ==============================================
// ERROR HANDLING
// ==============================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
