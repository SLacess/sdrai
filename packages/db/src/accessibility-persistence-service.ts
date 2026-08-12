import type { Prisma, PrismaClient } from '@prisma/client';

export interface AccessibilitySignalInput {
  type: string;
  severity: string;
  description: string;
  evidenceIds: string[];
}

export interface PersistAccessibilitySignalsParams {
  accountId: string;
  correlationId: string;
  signals: readonly AccessibilitySignalInput[];
  disclaimer: string;
  agentVersion: string;
  agentOutput: Prisma.InputJsonValue;
  confidence: number;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
}

export interface PersistAccessibilitySignalsResult {
  signalIds: string[];
  agentRunId: string;
}

/**
 * AccountSignal.value always embeds `isIndicatorOnly: true` unconditionally
 * — this function has no compliance/legal field to set in the first place,
 * so "no scan result can set compliance/legal status" holds even if a caller
 * somehow bypassed the Zod schema upstream (defense in depth, not the only
 * guard: see accessibility_intelligence's scanIsIndicator: z.literal(true)).
 */
export async function persistAccessibilitySignals(
  prisma: PrismaClient,
  params: PersistAccessibilitySignalsParams,
): Promise<PersistAccessibilitySignalsResult> {
  const signalIds: string[] = [];
  for (const signal of params.signals) {
    const created = await prisma.accountSignal.create({
      data: {
        accountId: params.accountId,
        type: signal.type,
        confidence: params.confidence,
        value: {
          severity: signal.severity,
          description: signal.description,
          evidenceIds: signal.evidenceIds,
          disclaimer: params.disclaimer,
          isIndicatorOnly: true,
        },
      },
    });
    signalIds.push(created.id);
  }

  const agentRun = await prisma.agentRun.create({
    data: {
      agent: 'accessibility_intelligence',
      agentVersion: params.agentVersion,
      entityType: 'ACCOUNT',
      entityId: params.accountId,
      inputRefs: { signalCount: params.signals.length },
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

  return { signalIds, agentRunId: agentRun.id };
}
