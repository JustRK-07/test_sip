/**
 * Redis Configuration for Bull Queue
 */

const Redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      logger.info('✓ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('✗ Redis connection error:', err);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    await redisClient.connect();
  }

  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
};

module.exports = {
  getRedisClient,
  disconnectRedis,
};
