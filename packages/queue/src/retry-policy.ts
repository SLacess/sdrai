import type { JobsOptions } from 'bullmq';

export const MAX_ATTEMPTS = 5;
export const BASE_BACKOFF_DELAY_MS = 2000;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: MAX_ATTEMPTS,
  backoff: { type: 'exponential', delay: BASE_BACKOFF_DELAY_MS },
  removeOnComplete: { age: 60 * 60 * 24 },
  removeOnFail: false,
};

/**
 * Mirrors BullMQ's built-in exponential backoff formula so the policy is unit
 * testable without a live Redis connection driving real job attempts.
 */
export function computeBackoffDelayMs(attemptsMade: number, baseDelayMs = BASE_BACKOFF_DELAY_MS): number {
  if (attemptsMade < 1) throw new Error('attemptsMade must be >= 1');
  return Math.round(baseDelayMs * Math.pow(2, attemptsMade - 1));
}

export function isFinalAttempt(attemptsMade: number, maxAttempts = MAX_ATTEMPTS): boolean {
  return attemptsMade >= maxAttempts;
}
