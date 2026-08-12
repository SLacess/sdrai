import { Queue, Worker, type ConnectionOptions, type Job, type JobsOptions, type Processor } from 'bullmq';
import { deadLetterQueueName, moveToDeadLetter, shouldMoveToDeadLetter } from './dlq';
import { DEFAULT_JOB_OPTIONS } from './retry-policy';

export function createQueue(name: string, connection: ConnectionOptions): Queue {
  return new Queue(name, { connection });
}

/**
 * Enqueues a job keyed by an idempotency key. BullMQ treats `jobId` as a
 * dedupe key within a queue: adding a job whose id already exists (waiting,
 * active, or delayed) is a no-op that returns the existing job instead of
 * creating a duplicate.
 */
export async function enqueueIdempotent<T>(
  queue: Queue<T, unknown, string>,
  jobName: string,
  idempotencyKey: string,
  data: T,
): Promise<Job<T, unknown, string>> {
  // BullMQ's `Queue.add` overloads infer name/data/result types from `T` when T
  // itself is a job-definition shape, which defeats plain generic inference here.
  // We assert the simpler (name, data, opts) => Job contract our wrapper actually uses.
  const add = queue.add.bind(queue) as unknown as (
    name: string,
    data: T,
    opts?: JobsOptions,
  ) => Promise<Job<T, unknown, string>>;
  return add(jobName, data, { ...DEFAULT_JOB_OPTIONS, jobId: idempotencyKey });
}

export function createIdempotentWorker<T>(
  name: string,
  connection: ConnectionOptions,
  processor: Processor<T, unknown, string>,
): Worker<T, unknown, string> {
  const dlq = createQueue(deadLetterQueueName(name), connection);
  const worker = new Worker<T, unknown, string>(name, processor, { connection });

  worker.on('failed', (job, error) => {
    if (!job) return;
    if (shouldMoveToDeadLetter(job.attemptsMade)) {
      void moveToDeadLetter(dlq, {
        id: job.id,
        name: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: error.message,
      });
    }
  });

  return worker;
}
