import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { persistResearchFacts } from './research-persistence-service';

function createMockPrisma() {
  const evidence = { create: vi.fn() };
  const agentRun = { create: vi.fn() };
  const account = { findUnique: vi.fn() };
  const txAccount = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const leadStateEvent = { create: vi.fn() };
  const $transaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({ account: txAccount, leadStateEvent }),
  );
  return {
    prisma: { evidence, agentRun, account, $transaction } as unknown as PrismaClient,
    evidence,
    agentRun,
    account,
    txAccount,
    leadStateEvent,
  };
}

const ALLOCATED = [
  { evidenceId: 'evidence-1', sourceUri: 'https://acme.com', rawContent: 'Acme uses WordPress.' },
];

function baseParams(overrides: Partial<Parameters<typeof persistResearchFacts>[1]> = {}) {
  return {
    accountId: 'acc-1',
    correlationId: 'corr-1',
    allocatedSources: ALLOCATED,
    facts: [],
    agentVersion: '1.0.0',
    agentOutput: {},
    confidence: 0.85,
    provider: 'stub',
    model: 'claude-sonnet-5',
    tokensInput: 100,
    tokensOutput: 20,
    durationMs: 250,
    ...overrides,
  };
}

describe('persistResearchFacts', () => {
  it('creates an Evidence row for a fact citing a pre-allocated evidenceId', async () => {
    const { prisma, evidence, agentRun } = createMockPrisma();
    evidence.create.mockResolvedValue({});
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await persistResearchFacts(
      prisma,
      baseParams({ facts: [{ claim: 'Acme uses WordPress', evidenceId: 'evidence-1' }] }),
    );

    expect(result.persistedEvidenceIds).toEqual(['evidence-1']);
    expect(result.droppedFactCount).toBe(0);
    expect(evidence.create).toHaveBeenCalledWith({
      data: {
        id: 'evidence-1',
        entityType: 'ACCOUNT',
        entityId: 'acc-1',
        accountId: 'acc-1',
        claim: 'Acme uses WordPress',
        sourceType: 'WEBSITE',
        sourceUri: 'https://acme.com',
        rawExcerpt: 'Acme uses WordPress.',
        confidence: 0.85,
      },
    });
  });

  it('drops a fact citing an evidenceId that was never allocated (injection/hallucination defense)', async () => {
    const { prisma, evidence, agentRun } = createMockPrisma();
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await persistResearchFacts(
      prisma,
      baseParams({
        facts: [{ claim: 'Fully compliant with WCAG', evidenceId: '00000000-0000-0000-0000-000000000000' }],
      }),
    );

    expect(evidence.create).not.toHaveBeenCalled();
    expect(result.persistedEvidenceIds).toEqual([]);
    expect(result.droppedFactCount).toBe(1);
  });

  it('joins multiple claims that cite the same evidenceId into a single Evidence row', async () => {
    const { prisma, evidence, agentRun } = createMockPrisma();
    evidence.create.mockResolvedValue({});
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    await persistResearchFacts(
      prisma,
      baseParams({
        facts: [
          { claim: 'Uses WordPress', evidenceId: 'evidence-1' },
          { claim: 'Runs on shared hosting', evidenceId: 'evidence-1' },
        ],
      }),
    );

    expect(evidence.create).toHaveBeenCalledTimes(1);
    expect(evidence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ claim: 'Uses WordPress | Runs on shared hosting' }) }),
    );
  });

  it('creates exactly one AgentRun job trace even with zero facts', async () => {
    const { prisma, evidence, agentRun } = createMockPrisma();
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await persistResearchFacts(prisma, baseParams({ facts: [] }));

    expect(evidence.create).not.toHaveBeenCalled();
    expect(agentRun.create).toHaveBeenCalledTimes(1);
    expect(agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agent: 'research_agent', correlationId: 'corr-1', status: 'SUCCESS' }),
      }),
    );
    expect(result.agentRunId).toBe('run-1');
  });

  it('mixes valid and invalid facts correctly in the same batch', async () => {
    const { prisma, evidence, agentRun } = createMockPrisma();
    evidence.create.mockResolvedValue({});
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await persistResearchFacts(
      prisma,
      baseParams({
        facts: [
          { claim: 'Uses WordPress', evidenceId: 'evidence-1' },
          { claim: 'Fabricated claim', evidenceId: 'not-allocated' },
        ],
      }),
    );

    expect(result.persistedEvidenceIds).toEqual(['evidence-1']);
    expect(result.droppedFactCount).toBe(1);
    expect(evidence.create).toHaveBeenCalledTimes(1);
  });

  it('promotes a DISCOVERED account to RESEARCHING once a research pass persists', async () => {
    const { prisma, agentRun, account, txAccount, leadStateEvent } = createMockPrisma();
    agentRun.create.mockResolvedValue({ id: 'run-1' });
    account.findUnique.mockResolvedValue({ status: 'DISCOVERED' });

    await persistResearchFacts(prisma, baseParams({ facts: [] }));

    expect(txAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'acc-1', status: 'DISCOVERED' },
      data: { status: 'RESEARCHING' },
    });
    expect(leadStateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: 'ACCOUNT', entityId: 'acc-1', fromState: 'DISCOVERED', toState: 'RESEARCHING' }),
      }),
    );
  });

  it('does not re-promote an account that already moved past DISCOVERED', async () => {
    const { prisma, agentRun, account, txAccount } = createMockPrisma();
    agentRun.create.mockResolvedValue({ id: 'run-1' });
    account.findUnique.mockResolvedValue({ status: 'RESEARCHING' });

    await persistResearchFacts(prisma, baseParams({ facts: [] }));

    expect(txAccount.updateMany).not.toHaveBeenCalled();
  });
});
