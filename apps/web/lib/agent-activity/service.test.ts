import type { PrismaClient } from '@sinal/db';
import { describe, expect, it, vi } from 'vitest';
import { calculatePercentile, loadAgentActivity } from './service';

describe('calculatePercentile', () => {
  it('returns null for an empty array', () => {
    expect(calculatePercentile([], 50)).toBeNull();
  });

  it('returns the single value for a one-element array at any percentile', () => {
    expect(calculatePercentile([42], 50)).toBe(42);
    expect(calculatePercentile([42], 95)).toBe(42);
  });

  it('computes p50 as the median for an odd-length sorted array', () => {
    expect(calculatePercentile([10, 20, 30, 40, 50], 50)).toBe(30);
  });

  it('computes p95 as the max for a small array (nearest-rank)', () => {
    expect(calculatePercentile([10, 20, 30, 40, 50], 95)).toBe(50);
  });

  it('computes p50/p95 over a larger dataset', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(calculatePercentile(values, 50)).toBe(50);
    expect(calculatePercentile(values, 95)).toBe(95);
  });
});

function createMockPrisma() {
  const agentRun = {
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { costMicrosUsd: null } }),
    findMany: vi.fn().mockResolvedValue([]),
  };
  return { prisma: { agentRun } as unknown as PrismaClient, agentRun };
}

function runRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    agent: 'research_agent',
    agentVersion: '1.0.0',
    status: 'SUCCESS',
    model: 'claude-sonnet-5',
    provider: 'anthropic',
    tokensInput: 100,
    tokensOutput: 50,
    costMicrosUsd: 1200,
    durationMs: 800,
    correlationId: 'corr-1',
    errorMessage: null,
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    ...overrides,
  };
}

describe('loadAgentActivity', () => {
  it('returns zeroed stats and empty lists against a fresh database', async () => {
    const { prisma } = createMockPrisma();

    const result = await loadAgentActivity(prisma);

    expect(result.stats).toEqual({
      totalRuns: 0,
      failedRuns: 0,
      failureRate: 0,
      totalCostMicrosUsd: 0,
      latencyP50Ms: null,
      latencyP95Ms: null,
    });
    expect(result.recentRuns).toEqual([]);
    expect(result.failedRuns).toEqual([]);
  });

  it('computes failure rate from total vs. failed counts', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);

    const result = await loadAgentActivity(prisma);

    expect(result.stats.failureRate).toBe(0.2);
  });

  it('sums cost to zero when no run has recorded a cost', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.aggregate.mockResolvedValue({ _sum: { costMicrosUsd: null } });

    const result = await loadAgentActivity(prisma);

    expect(result.stats.totalCostMicrosUsd).toBe(0);
  });

  it('computes latency percentiles only from runs with a recorded duration', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.findMany.mockImplementation((args: { select?: { durationMs: boolean } }) => {
      if (args?.select?.durationMs) {
        return Promise.resolve([{ durationMs: 100 }, { durationMs: 300 }, { durationMs: 200 }]);
      }
      return Promise.resolve([]);
    });

    const result = await loadAgentActivity(prisma);

    expect(result.stats.latencyP50Ms).toBe(200);
    expect(result.stats.latencyP95Ms).toBe(300);
  });

  it('maps recent and failed runs to the summary DTO shape', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.findMany.mockImplementation((args: { where?: { status?: string; durationMs?: unknown } }) => {
      if (args?.where?.durationMs) return Promise.resolve([]);
      if (args?.where?.status === 'FAILED') {
        return Promise.resolve([runRow({ id: 'run-failed', status: 'FAILED', errorMessage: 'Timeout' })]);
      }
      return Promise.resolve([runRow()]);
    });

    const result = await loadAgentActivity(prisma);

    expect(result.recentRuns).toEqual([runRow()]);
    expect(result.failedRuns).toEqual([runRow({ id: 'run-failed', status: 'FAILED', errorMessage: 'Timeout' })]);
  });
});
