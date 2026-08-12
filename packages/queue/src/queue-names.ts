export const QUEUE_NAMES = {
  ACCOUNT_DISCOVERY: 'account-discovery',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
