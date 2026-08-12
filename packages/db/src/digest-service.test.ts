import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { generateDailySupervisorDigest } from './digest-service';

function createMockPrisma() {
  const account = { count: vi.fn().mockResolvedValue(0) };
  const leadStateEvent = { count: vi.fn().mockResolvedValue(0) };
  const meeting = { count: vi.fn().mockResolvedValue(0) };
  const agentRun = {
    aggregate: vi.fn().mockResolvedValue({ _sum: { costMicrosUsd: null } }),
    groupBy: vi.fn().mockResolvedValue([]),
  };
  const approval = { groupBy: vi.fn().mockResolvedValue([]) };
  const messageDraft = { count: vi.fn().mockResolvedValue(0) };
  const digest = { upsert: vi.fn().mockResolvedValue({ id: 'digest-1' }) };
  return {
    prisma: { account, leadStateEvent, meeting, agentRun, approval, messageDraft, digest } as unknown as PrismaClient,
    account,
    leadStateEvent,
    meeting,
    agentRun,
    approval,
    messageDraft,
    digest,
  };
}

const WINDOW = {
  forDate: new Date('2026-08-11T00:00:00.000Z'),
  windowStart: new Date('2026-08-11T00:00:00.000Z'),
  windowEnd: new Date('2026-08-12T00:00:00.000Z'),
};

describe('generateDailySupervisorDigest', () => {
  it('produces a zeroed digest against a fresh database', async () => {
    const { prisma } = createMockPrisma();

    const { content } = await generateDailySupervisorDigest(prisma, WINDOW);

    expect(content).toEqual({
      forDate: '2026-08-11',
      metrics: { totalAccounts: 0, qualifiedAccounts: 0, newSqlCount: 0, meetingsScheduledCount: 0, aiSpendMicrosUsd: 0 },
      pendingApprovals: { total: 0, byRiskLevel: {} },
      failures: { total: 0, byAgent: {} },
      blockedActions: { total: 0 },
    });
  });

  it('sums pending approvals across risk levels into a total and a breakdown', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.groupBy.mockResolvedValue([
      { riskLevel: 'YELLOW', _count: 3 },
      { riskLevel: 'RED', _count: 1 },
    ]);

    const { content } = await generateDailySupervisorDigest(prisma, WINDOW);

    expect(content.pendingApprovals).toEqual({ total: 4, byRiskLevel: { YELLOW: 3, RED: 1 } });
  });

  it('sums failed agent runs across agents into a total and a breakdown', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.groupBy.mockResolvedValue([
      { agent: 'research_agent', _count: 2 },
      { agent: 'reply_classifier', _count: 1 },
    ]);

    const { content } = await generateDailySupervisorDigest(prisma, WINDOW);

    expect(content.failures).toEqual({ total: 3, byAgent: { research_agent: 2, reply_classifier: 1 } });
  });

  it('contains no contact- or message-level PII fields anywhere in the content', async () => {
    const { prisma, approval, agentRun } = createMockPrisma();
    approval.groupBy.mockResolvedValue([{ riskLevel: 'YELLOW', _count: 1 }]);
    agentRun.groupBy.mockResolvedValue([{ agent: 'research_agent', _count: 1 }]);

    const { content } = await generateDailySupervisorDigest(prisma, WINDOW);

    const serialized = JSON.stringify(content).toLowerCase();
    for (const forbidden of ['email', 'phone', 'name', 'contact', '@']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('upserts the digest keyed by type and forDate so re-running the same day updates in place', async () => {
    const { prisma, digest } = createMockPrisma();

    await generateDailySupervisorDigest(prisma, WINDOW);

    expect(digest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type_forDate: { type: 'DAILY_SUPERVISOR', forDate: WINDOW.forDate } },
      }),
    );
  });

  it('sums AI spend to zero when no agent run recorded a cost in the window', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.aggregate.mockResolvedValue({ _sum: { costMicrosUsd: null } });

    const { content } = await generateDailySupervisorDigest(prisma, WINDOW);

    expect(content.metrics.aiSpendMicrosUsd).toBe(0);
  });
});
