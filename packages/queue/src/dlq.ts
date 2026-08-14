import type { Queue } from 'bullmq';
import { isFinalAttempt, MAX_ATTEMPTS } from './retry-policy';

export interface FailedJobInfo {
  id: string | undefined;
  name: string;
  data: unknown;
  attemptsMade: number;
  failedReason: string;
}

export function shouldMoveToDeadLetter(attemptsMade: number, maxAttempts = MAX_ATTEMPTS): boolean {
  return isFinalAttempt(attemptsMade, maxAttempts);
}

export function deadLetterQueueName(sourceQueueName: string): string {
  return `${sourceQueueName}-dlq`;
}

export async function moveToDeadLetter(dlq: Queue, job: FailedJobInfo): Promise<void> {
  await dlq.add(
    job.name,
    { originalJobId: job.id, data: job.data, attemptsMade: job.attemptsMade, failedReason: job.failedReason },
    job.id ? { jobId: `dlq:${job.id}` } : {},
  );
}
