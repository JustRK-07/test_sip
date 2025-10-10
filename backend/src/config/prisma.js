/**
 * Prisma Client Singleton
 * Ensures only one Prisma instance is created across the application
 * This prevents connection pool exhaustion and improves performance
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

let prisma = null;

/**
 * Get or create Prisma Client instance
 * @returns {PrismaClient} Singleton Prisma client
 */
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
      errorFormat: 'minimal',
    });

    // Log successful connection
    logger.info('Prisma Client initialized');

    // Graceful shutdown handler
    const disconnect = async () => {
      if (prisma) {
        await prisma.$disconnect();
        logger.info('Prisma Client disconnected');
        prisma = null;
      }
    };

    // Handle process termination
    process.on('beforeExit', disconnect);
    process.on('SIGINT', async () => {
      await disconnect();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await disconnect();
      process.exit(0);
    });
  }

  return prisma;
}

/**
 * Disconnect Prisma Client
 * Useful for testing and graceful shutdown
 */
async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Prisma Client manually disconnected');
    prisma = null;
  }
}

module.exports = {
  getPrismaClient,
  disconnectPrisma
};
