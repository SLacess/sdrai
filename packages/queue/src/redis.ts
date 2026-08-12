import IORedis, { type Redis } from 'ioredis';

export function createRedisConnection(url = process.env.REDIS_URL ?? 'redis://localhost:6379'): Redis {
  // BullMQ requires maxRetriesPerRequest: null and lazy connect so importing
  // this module never opens a socket outside of an actual runtime/worker process.
  return new IORedis(url, { maxRetriesPerRequest: null, lazyConnect: true });
}
