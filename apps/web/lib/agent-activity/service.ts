import type { AgentRunStatus, PrismaClient } from '@sinal/db';

const RECENT_RUNS_LIMIT = 100;

export interface AgentRunSummaryDTO {
  id: string;
  agent: string;
  agentVersion: string;
  status: AgentRunStatus;
  model: string | null;
  provider: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costMicrosUsd: number | null;
  durationMs: number | null;
  correlationId: string;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AgentActivityStats {
  totalRuns: number;
  failedRuns: number;
  failureRate: number;
  totalCostMicrosUsd: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
}

export interface AgentActivityDTO {
  stats: AgentActivityStats;
  recentRuns: AgentRunSummaryDTO[];
  failedRuns: AgentRunSummaryDTO[];
}

/**
 * Nearest-rank percentile over an already-sorted-ascending array. Returns
 * null on an empty input rather than NaN/0, so the UI can render "—"
 * instead of a misleading zero when no run has a recorded duration yet.
 */
export function calculatePercentile(sortedAscendingValues: readonly number[], percentile: number): number | null {
  if (sortedAscendingValues.length === 0) return null;
  const rank = Math.ceil((percentile / 100) * sortedAscendingValues.length) - 1;
  const index = Math.min(Math.max(rank, 0), sortedAscendingValues.length - 1);
  return sortedAscendingValues[index] ?? null;
}

interface AgentRunRow {
  id: string;
  agent: string;
  agentVersion: string;
  status: AgentRunStatus;
  model: string | null;
  provider: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costMicrosUsd: number | null;
  durationMs: number | null;
  correlationId: string;
  errorMessage: string | null;
  createdAt: Date;
}

function toRunSummary(run: AgentRunRow): AgentRunSummaryDTO {
  return {
    id: run.id,
    agent: run.agent,
    agentVersion: run.agentVersion,
    status: run.status,
    model: run.model,
    provider: run.provider,
    tokensInput: run.tokensInput,
    tokensOutput: run.tokensOutput,
    costMicrosUsd: run.costMicrosUsd,
    durationMs: run.durationMs,
    correlationId: run.correlationId,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt,
  };
}

export async function loadAgentActivity(prisma: PrismaClient): Promise<AgentActivityDTO> {
  const [totalRuns, failedCount, spend, recentRuns, failedRunRows, durationRows] = await Promise.all([
    prisma.agentRun.count(),
    prisma.agentRun.count({ where: { status: 'FAILED' } }),
    prisma.agentRun.aggregate({ _sum: { costMicrosUsd: true } }),
    prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: RECENT_RUNS_LIMIT }),
    prisma.agentRun.findMany({ where: { status: 'FAILED' }, orderBy: { createdAt: 'desc' }, take: RECENT_RUNS_LIMIT }),
    prisma.agentRun.findMany({ where: { durationMs: { not: null } }, select: { durationMs: true } }),
  ]);

  const durations = durationRows
    .map((row) => row.durationMs)
    .filter((duration): duration is number => duration !== null)
    .sort((a, b) => a - b);

  return {
    stats: {
      totalRuns,
      failedRuns: failedCount,
      failureRate: totalRuns > 0 ? failedCount / totalRuns : 0,
      totalCostMicrosUsd: spend._sum.costMicrosUsd ?? 0,
      latencyP50Ms: calculatePercentile(durations, 50),
      latencyP95Ms: calculatePercentile(durations, 95),
    },
    recentRuns: recentRuns.map(toRunSummary),
    failedRuns: failedRunRows.map(toRunSummary),
  };
}
