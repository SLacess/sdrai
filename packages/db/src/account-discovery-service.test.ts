import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { upsertDiscoveredAccounts } from './account-discovery-service';

function createMockPrisma() {
  const account = { upsert: vi.fn() };
  const agentRun = { create: vi.fn() };
  return { prisma: { account, agentRun } as unknown as PrismaClient, account, agentRun };
}

function createdAccount(id: string) {
  const now = new Date('2026-08-11T00:00:00.000Z');
  return { id, createdAt: now, updatedAt: now };
}

function updatedAccount(id: string) {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
  };
}

describe('upsertDiscoveredAccounts', () => {
  it('upserts each candidate by domain and counts creates vs updates', async () => {
    const { prisma, account, agentRun } = createMockPrisma();
    account.upsert.mockResolvedValueOnce(createdAccount('acc-new'));
    account.upsert.mockResolvedValueOnce(updatedAccount('acc-existing'));
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await upsertDiscoveredAccounts(prisma, {
      correlationId: 'corr-1',
      campaignId: 'campaign-1',
      candidates: [
        { brandName: 'Aurora Varejo', domain: 'aurora.example.com' },
        { brandName: 'Norte Bancário', domain: 'norte.example.com', country: 'BR' },
      ],
    });

    expect(result.createdCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.accountIds).toEqual(['acc-new', 'acc-existing']);
    expect(result.agentRunId).toBe('run-1');

    expect(account.upsert).toHaveBeenNthCalledWith(1, {
      where: { domain: 'aurora.example.com' },
      update: { brandName: 'Aurora Varejo', normalizedName: 'aurora varejo' },
      create: { brandName: 'Aurora Varejo', domain: 'aurora.example.com', normalizedName: 'aurora varejo' },
    });
  });

  it('creates exactly one AgentRun per job regardless of candidate count (job trace exists)', async () => {
    const { prisma, account, agentRun } = createMockPrisma();
    account.upsert.mockResolvedValue(createdAccount('acc-1'));
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    await upsertDiscoveredAccounts(prisma, {
      correlationId: 'corr-1',
      campaignId: 'campaign-1',
      candidates: [
        { brandName: 'A', domain: 'a.example.com' },
        { brandName: 'B', domain: 'b.example.com' },
        { brandName: 'C', domain: 'c.example.com' },
      ],
    });

    expect(agentRun.create).toHaveBeenCalledTimes(1);
    expect(agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agent: 'account_discovery_job',
          correlationId: 'corr-1',
          outputJson: { createdCount: 3, updatedCount: 0, accountIds: ['acc-1', 'acc-1', 'acc-1'] },
        }),
      }),
    );
  });

  it('a repeated domain across two candidates upserts to the same account (dedupe)', async () => {
    const { prisma, account, agentRun } = createMockPrisma();
    account.upsert.mockResolvedValue(createdAccount('acc-1'));
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await upsertDiscoveredAccounts(prisma, {
      correlationId: 'corr-1',
      campaignId: 'campaign-1',
      candidates: [
        { brandName: 'Acme', domain: 'acme.com' },
        { brandName: 'Acme Corp', domain: 'acme.com' },
      ],
    });

    expect(new Set(result.accountIds).size).toBe(1);
    expect(account.upsert).toHaveBeenCalledTimes(2);
    expect(account.upsert.mock.calls[0]?.[0].where).toEqual({ domain: 'acme.com' });
    expect(account.upsert.mock.calls[1]?.[0].where).toEqual({ domain: 'acme.com' });
  });

  it('handles an empty candidate list by still writing a job trace', async () => {
    const { prisma, account, agentRun } = createMockPrisma();
    agentRun.create.mockResolvedValue({ id: 'run-empty' });

    const result = await upsertDiscoveredAccounts(prisma, {
      correlationId: 'corr-1',
      campaignId: 'campaign-1',
      candidates: [],
    });

    expect(account.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ createdCount: 0, updatedCount: 0, accountIds: [], agentRunId: 'run-empty' });
  });
});
