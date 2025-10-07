/**
 * Server Entry Point
 */

require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { prisma, disconnectDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Start server
const server = app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 Server running in ${NODE_ENV} mode`);
  logger.info(`📡 Listening on port ${PORT}`);
  logger.info(`🔗 API: http://localhost:${PORT}${process.env.API_PREFIX || '/api/v1'}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`💚 Health Check: http://localhost:${PORT}/health`);
  logger.info('='.repeat(60));
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connection
    await disconnectDatabase();

    // Close Redis connection if initialized
    try {
      const { disconnectRedis } = require('./config/redis');
      await disconnectRedis();
    } catch (error) {
      // Redis might not be initialized yet
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the server, but log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = server;
