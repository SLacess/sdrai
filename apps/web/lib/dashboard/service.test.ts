import type { PrismaClient } from '@sinal/db';
import { describe, expect, it, vi } from 'vitest';
import { loadCommandCenterQueue } from './service';

function createMockPrisma() {
  const account = { count: vi.fn().mockResolvedValue(0) };
  const contact = { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) };
  const approval = { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) };
  const agentRun = {
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { costMicrosUsd: null } }),
    findMany: vi.fn().mockResolvedValue([]),
  };
  const meeting = { findMany: vi.fn().mockResolvedValue([]) };
  return {
    prisma: { account, contact, approval, agentRun, meeting } as unknown as PrismaClient,
    account,
    contact,
    approval,
    agentRun,
    meeting,
  };
}

describe('loadCommandCenterQueue', () => {
  it('returns zeroed metrics and empty queues against a fresh database', async () => {
    const { prisma } = createMockPrisma();

    const result = await loadCommandCenterQueue(prisma);

    expect(result.metrics).toEqual({
      totalAccounts: 0,
      qualifiedAccounts: 0,
      totalContacts: 0,
      pendingApprovals: 0,
      totalAgentRuns: 0,
      failedAgentRuns: 0,
      aiSpendMicrosUsd: 0,
    });
    expect(result.sqlQueue).toEqual([]);
    expect(result.upcomingMeetings).toEqual([]);
    expect(result.pendingApprovals).toEqual([]);
    expect(result.recentFailures).toEqual([]);
  });

  it('maps SQL contacts to the queue shape with their account name', async () => {
    const { prisma, contact } = createMockPrisma();
    contact.findMany.mockResolvedValue([
      {
        id: 'contact-1',
        name: 'Jane Doe',
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        account: { id: 'acc-1', brandName: 'Acme' },
      },
    ]);

    const result = await loadCommandCenterQueue(prisma);

    expect(result.sqlQueue).toEqual([
      {
        contactId: 'contact-1',
        contactName: 'Jane Doe',
        accountId: 'acc-1',
        accountName: 'Acme',
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    expect(contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadState: 'SQL' } }),
    );
  });

  it('only queries meetings scheduled at or after "now"', async () => {
    const { prisma, meeting } = createMockPrisma();
    const now = new Date('2026-08-11T12:00:00.000Z');
    meeting.findMany.mockResolvedValue([
      {
        id: 'meeting-1',
        scheduledAt: new Date('2026-08-12T14:00:00.000Z'),
        timezone: 'America/Sao_Paulo',
        status: 'SCHEDULED',
        opportunity: { account: { id: 'acc-1', brandName: 'Acme' } },
      },
    ]);

    const result = await loadCommandCenterQueue(prisma, now);

    expect(meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheduledAt: { gte: now } } }),
    );
    expect(result.upcomingMeetings).toEqual([
      {
        meetingId: 'meeting-1',
        scheduledAt: new Date('2026-08-12T14:00:00.000Z'),
        timezone: 'America/Sao_Paulo',
        status: 'SCHEDULED',
        accountId: 'acc-1',
        accountName: 'Acme',
      },
    ]);
  });

  it('maps failed agent runs to the failure DTO shape', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        agent: 'research_agent',
        errorMessage: 'Timeout calling provider',
        createdAt: new Date('2026-08-10T00:00:00.000Z'),
        correlationId: 'corr-1',
      },
    ]);

    const result = await loadCommandCenterQueue(prisma);

    expect(result.recentFailures).toEqual([
      {
        id: 'run-1',
        agent: 'research_agent',
        errorMessage: 'Timeout calling provider',
        createdAt: new Date('2026-08-10T00:00:00.000Z'),
        correlationId: 'corr-1',
      },
    ]);
    expect(agentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'FAILED' } }),
    );
  });

  it('sums AI spend to zero when no agent runs have recorded a cost', async () => {
    const { prisma, agentRun } = createMockPrisma();
    agentRun.aggregate.mockResolvedValue({ _sum: { costMicrosUsd: null } });

    const result = await loadCommandCenterQueue(prisma);

    expect(result.metrics.aiSpendMicrosUsd).toBe(0);
  });

  it('passes pending approvals through from listPendingApprovals', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findMany.mockResolvedValue([{ id: 'approval-1', status: 'PENDING' }]);

    const result = await loadCommandCenterQueue(prisma);

    expect(result.pendingApprovals).toEqual([{ id: 'approval-1', status: 'PENDING' }]);
  });
});
