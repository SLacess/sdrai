import type { PrismaClient } from '@prisma/client';
import { normalizeName } from '@sinal/domain';

export interface DiscoveredAccountCandidateInput {
  brandName: string;
  domain: string;
  country?: string;
  sector?: string;
}

export interface UpsertDiscoveredAccountsParams {
  correlationId: string;
  campaignId: string;
  candidates: readonly DiscoveredAccountCandidateInput[];
}

export interface UpsertDiscoveredAccountsResult {
  createdCount: number;
  updatedCount: number;
  accountIds: string[];
  agentRunId: string;
}

/**
 * Dedupes discovered accounts by domain (the schema's unique key) via
 * upsert, then writes a single AgentRun so the job is traceable end to end
 * (BP-011 acceptance: duplicate domain -> one account; job trace exists).
 */
export async function upsertDiscoveredAccounts(
  prisma: PrismaClient,
  params: UpsertDiscoveredAccountsParams,
): Promise<UpsertDiscoveredAccountsResult> {
  let createdCount = 0;
  let updatedCount = 0;
  const accountIds: string[] = [];
  const startedAt = new Date();

  for (const candidate of params.candidates) {
    const account = await prisma.account.upsert({
      where: { domain: candidate.domain },
      update: {
        brandName: candidate.brandName,
        normalizedName: normalizeName(candidate.brandName),
        ...(candidate.country ? { country: candidate.country } : {}),
        ...(candidate.sector ? { sector: candidate.sector } : {}),
      },
      create: {
        brandName: candidate.brandName,
        domain: candidate.domain,
        normalizedName: normalizeName(candidate.brandName),
        ...(candidate.country ? { country: candidate.country } : {}),
        ...(candidate.sector ? { sector: candidate.sector } : {}),
      },
    });

    // A fresh insert sets createdAt/updatedAt to the same instant; @updatedAt
    // only advances updatedAt on a genuine update, so equality distinguishes
    // create vs update without an extra read (and its race window).
    if (account.createdAt.getTime() === account.updatedAt.getTime()) createdCount++;
    else updatedCount++;
    accountIds.push(account.id);
  }

  const agentRun = await prisma.agentRun.create({
    data: {
      agent: 'account_discovery_job',
      agentVersion: '1.0.0',
      status: 'SUCCESS',
      inputRefs: { campaignId: params.campaignId, candidateCount: params.candidates.length },
      outputJson: { createdCount, updatedCount, accountIds },
      correlationId: params.correlationId,
      startedAt,
      completedAt: new Date(),
    },
  });

  return { createdCount, updatedCount, accountIds, agentRunId: agentRun.id };
}
