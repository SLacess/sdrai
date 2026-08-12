import { randomUUID } from 'node:crypto';
import type { Queue } from '@sinal/queue';

export interface DiscoverAccountsInput {
  campaignId: string;
  limit: number;
  sourceKeys?: string[] | undefined;
}

export interface JobAcceptedDTO {
  jobId: string;
  status: 'QUEUED';
  correlationId: string;
}

export async function enqueueAccountDiscovery(queue: Queue, input: DiscoverAccountsInput): Promise<JobAcceptedDTO> {
  const jobId = randomUUID();
  const correlationId = randomUUID();

  await queue.add(
    'discover',
    { campaignId: input.campaignId, limit: input.limit, sourceKeys: input.sourceKeys, correlationId },
    { jobId },
  );

  return { jobId, status: 'QUEUED', correlationId };
}
