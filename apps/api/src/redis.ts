import IORedis from 'ioredis';

/**
 * Shared Redis connection for BullMQ queues and workers.
 * `family: 0` enables dual-stack DNS lookup (IPv4 + IPv6) for Railway compatibility.
 */
export const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  family: 0,
});
