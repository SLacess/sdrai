import type { Evidence, Prisma, PrismaClient } from '@prisma/client';

export interface ResearchFactInput {
  claim: string;
  evidenceId: string;
}

export interface AllocatedResearchSourceInput {
  evidenceId: string;
  sourceUri: string;
  rawContent: string;
}

export interface PersistResearchFactsParams {
  accountId: string;
  correlationId: string;
  allocatedSources: readonly AllocatedResearchSourceInput[];
  facts: readonly ResearchFactInput[];
  agentVersion: string;
  agentOutput: Prisma.InputJsonValue;
  confidence: number;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
}

export interface PersistResearchFactsResult {
  persistedEvidenceIds: string[];
  droppedFactCount: number;
  agentRunId: string;
}

/**
 * Only creates Evidence rows for facts citing an evidenceId we pre-allocated
 * ourselves (see allocateEvidenceIds in @sinal/ai). A fact citing any other
 * id — hallucinated or smuggled in via a prompt-injection attempt in the
 * scraped source content — is silently dropped here rather than persisted,
 * which is the actual enforcement of "facts always bind evidence".
 */
export async function persistResearchFacts(
  prisma: PrismaClient,
  params: PersistResearchFactsParams,
): Promise<PersistResearchFactsResult> {
  const allocatedById = new Map(params.allocatedSources.map((source) => [source.evidenceId, source]));
  const validFacts = params.facts.filter((fact) => allocatedById.has(fact.evidenceId));
  const droppedFactCount = params.facts.length - validFacts.length;

  const claimsByEvidenceId = new Map<string, string[]>();
  for (const fact of validFacts) {
    const claims = claimsByEvidenceId.get(fact.evidenceId) ?? [];
    claims.push(fact.claim);
    claimsByEvidenceId.set(fact.evidenceId, claims);
  }

  const persistedEvidenceIds: string[] = [];
  const evidenceCreates: Promise<Evidence>[] = [];
  for (const [evidenceId, claims] of claimsByEvidenceId) {
    const source = allocatedById.get(evidenceId);
    if (!source) continue;
    persistedEvidenceIds.push(evidenceId);
    evidenceCreates.push(
      prisma.evidence.create({
        data: {
          id: evidenceId,
          entityType: 'ACCOUNT',
          entityId: params.accountId,
          accountId: params.accountId,
          claim: claims.join(' | '),
          sourceType: 'WEBSITE',
          sourceUri: source.sourceUri,
          rawExcerpt: source.rawContent.slice(0, 2000),
          confidence: params.confidence,
        },
      }),
    );
  }
  await Promise.all(evidenceCreates);

  const agentRun = await prisma.agentRun.create({
    data: {
      agent: 'research_agent',
      agentVersion: params.agentVersion,
      entityType: 'ACCOUNT',
      entityId: params.accountId,
      inputRefs: { sourceCount: params.allocatedSources.length },
      outputJson: params.agentOutput,
      provider: params.provider,
      model: params.model,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
      durationMs: params.durationMs,
      confidence: params.confidence,
      status: 'SUCCESS',
      correlationId: params.correlationId,
      startedAt: new Date(Date.now() - params.durationMs),
      completedAt: new Date(),
    },
  });

  return { persistedEvidenceIds, droppedFactCount, agentRunId: agentRun.id };
}
