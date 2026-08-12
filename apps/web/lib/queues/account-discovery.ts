import { createQueue, createRedisConnection, QUEUE_NAMES, type Queue } from '@sinal/queue';

declare global {
  var __sinalAccountDiscoveryQueue: Queue | undefined;
}

function createAccountDiscoveryQueue(): Queue {
  const connection = createRedisConnection();
  return createQueue(QUEUE_NAMES.ACCOUNT_DISCOVERY, connection);
}

export const accountDiscoveryQueue: Queue = globalThis.__sinalAccountDiscoveryQueue ?? createAccountDiscoveryQueue();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sinalAccountDiscoveryQueue = accountDiscoveryQueue;
}
