/**
 * Database Configuration using Prisma
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Prisma Client Singleton
let prisma;

const getDatabaseClient = () => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug(`Query: ${e.query}`);
        logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Handle connection errors
    prisma.$connect()
      .then(() => {
        logger.info('✓ Database connected successfully');
      })
      .catch((error) => {
        logger.error('✗ Database connection failed:', error);
        process.exit(1);
      });
  }

  return prisma;
};

// Graceful shutdown
const disconnectDatabase = async () => {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
};

module.exports = {
  prisma: getDatabaseClient(),
  disconnectDatabase,
};
