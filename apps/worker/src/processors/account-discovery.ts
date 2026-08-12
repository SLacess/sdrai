import type { PrismaClient } from '@sinal/db';
import { upsertDiscoveredAccounts } from '@sinal/db';
import type { LeadProvider } from '@sinal/integrations';
import { runWithTraceContext } from '@sinal/observability';
import type { Job } from '@sinal/queue';

export interface AccountDiscoveryJobData {
  campaignId: string;
  limit: number;
  sourceKeys?: string[];
  correlationId: string;
}

export function createAccountDiscoveryProcessor(prisma: PrismaClient, leadProvider: LeadProvider) {
  return async function processAccountDiscovery(job: Job<AccountDiscoveryJobData>): Promise<void> {
    const { campaignId, limit, sourceKeys, correlationId } = job.data;

    await runWithTraceContext({ correlationId, entityType: 'CAMPAIGN', entityId: campaignId }, async () => {
      const candidates = await leadProvider.discoverAccounts(
        sourceKeys ? { limit, sourceKeys } : { limit },
      );
      await upsertDiscoveredAccounts(prisma, { correlationId, campaignId, candidates });
    });
  };
}
