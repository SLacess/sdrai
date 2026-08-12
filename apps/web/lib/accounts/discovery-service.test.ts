import type { Queue } from '@sinal/queue';
import { describe, expect, it, vi } from 'vitest';
import { enqueueAccountDiscovery } from './discovery-service';

function createMockQueue() {
  const add = vi.fn().mockResolvedValue({});
  return { queue: { add } as unknown as Queue, add };
}

describe('enqueueAccountDiscovery', () => {
  it('enqueues a job with a generated jobId/correlationId and returns a QUEUED JobAccepted DTO', async () => {
    const { queue, add } = createMockQueue();

    const result = await enqueueAccountDiscovery(queue, { campaignId: 'campaign-1', limit: 100 });

    expect(result.status).toBe('QUEUED');
    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(add).toHaveBeenCalledWith(
      'discover',
      { campaignId: 'campaign-1', limit: 100, sourceKeys: undefined, correlationId: result.correlationId },
      { jobId: result.jobId },
    );
  });

  it('generates a fresh jobId/correlationId on every call', async () => {
    const { queue } = createMockQueue();
    const first = await enqueueAccountDiscovery(queue, { campaignId: 'campaign-1', limit: 10 });
    const second = await enqueueAccountDiscovery(queue, { campaignId: 'campaign-1', limit: 10 });
    expect(first.jobId).not.toBe(second.jobId);
    expect(first.correlationId).not.toBe(second.correlationId);
  });

  it('passes sourceKeys through when provided', async () => {
    const { queue, add } = createMockQueue();
    await enqueueAccountDiscovery(queue, { campaignId: 'campaign-1', limit: 10, sourceKeys: ['linkedin'] });
    expect(add.mock.calls[0]?.[1]).toMatchObject({ sourceKeys: ['linkedin'] });
  });
});
