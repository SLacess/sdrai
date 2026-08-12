import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { deadLetterQueueName, moveToDeadLetter, shouldMoveToDeadLetter } from './dlq';

describe('shouldMoveToDeadLetter', () => {
  it.each([
    [1, false],
    [4, false],
    [5, true],
  ])('attemptsMade=%i -> %s', (attemptsMade, expected) => {
    expect(shouldMoveToDeadLetter(attemptsMade)).toBe(expected);
  });
});

describe('deadLetterQueueName', () => {
  it('suffixes the source queue name with :dlq', () => {
    expect(deadLetterQueueName('outreach-scheduler')).toBe('outreach-scheduler:dlq');
  });
});

describe('moveToDeadLetter', () => {
  it('adds a job to the DLQ queue carrying the original failure context', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const dlq = { add } as unknown as Queue;

    await moveToDeadLetter(dlq, {
      id: 'job-42',
      name: 'send-first-touch',
      data: { contactId: 'contact-1' },
      attemptsMade: 5,
      failedReason: 'provider timeout',
    });

    expect(add).toHaveBeenCalledWith(
      'send-first-touch',
      {
        originalJobId: 'job-42',
        data: { contactId: 'contact-1' },
        attemptsMade: 5,
        failedReason: 'provider timeout',
      },
      { jobId: 'dlq:job-42' },
    );
  });

  it('omits jobId when the failed job has no id', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const dlq = { add } as unknown as Queue;

    await moveToDeadLetter(dlq, {
      id: undefined,
      name: 'send-first-touch',
      data: {},
      attemptsMade: 5,
      failedReason: 'provider timeout',
    });

    expect(add).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {});
  });
});
