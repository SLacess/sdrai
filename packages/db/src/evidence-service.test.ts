import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createEvidence, expireEvidence, getEvidenceForEntity, verifyRequiredEvidence } from './evidence-service';

function createMockPrisma() {
  const evidence = { create: vi.fn(), update: vi.fn(), findMany: vi.fn() };
  return { prisma: { evidence } as unknown as PrismaClient, evidence };
}

describe('createEvidence', () => {
  it('delegates to prisma.evidence.create', async () => {
    const { prisma, evidence } = createMockPrisma();
    evidence.create.mockResolvedValue({ id: 'ev-1' });
    const data = {
      entityType: 'ACCOUNT',
      entityId: 'acc-1',
      claim: 'Uses WordPress',
      sourceType: 'WEBSITE',
      confidence: 0.9,
    } as never;

    const result = await createEvidence(prisma, data);

    expect(evidence.create).toHaveBeenCalledWith({ data });
    expect(result).toEqual({ id: 'ev-1' });
  });
});

describe('expireEvidence', () => {
  it('sets expiresAt on the given evidence id', async () => {
    const { prisma, evidence } = createMockPrisma();
    evidence.update.mockResolvedValue({ id: 'ev-1', expiresAt: new Date('2026-01-01T00:00:00.000Z') });
    const at = new Date('2026-01-01T00:00:00.000Z');

    await expireEvidence(prisma, 'ev-1', at);

    expect(evidence.update).toHaveBeenCalledWith({ where: { id: 'ev-1' }, data: { expiresAt: at } });
  });
});

describe('getEvidenceForEntity', () => {
  it('queries by entityType/entityId ordered by most recent capture', async () => {
    const { prisma, evidence } = createMockPrisma();
    evidence.findMany.mockResolvedValue([{ id: 'ev-1' }]);

    const result = await getEvidenceForEntity(prisma, 'ACCOUNT', 'acc-1');

    expect(evidence.findMany).toHaveBeenCalledWith({
      where: { entityType: 'ACCOUNT', entityId: 'acc-1' },
      orderBy: { capturedAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'ev-1' }]);
  });
});

describe('verifyRequiredEvidence', () => {
  it('returns allPresent=true without querying when no ids are required', async () => {
    const { prisma, evidence } = createMockPrisma();
    const result = await verifyRequiredEvidence(prisma, []);
    expect(result).toEqual({ allPresent: true, missingIds: [], expiredIds: [] });
    expect(evidence.findMany).not.toHaveBeenCalled();
  });

  it('excludes expired evidence from a valid external claim check', async () => {
    const { prisma, evidence } = createMockPrisma();
    const now = new Date('2026-08-11T12:00:00.000Z');
    evidence.findMany.mockResolvedValue([
      { id: 'ev-1', expiresAt: null },
      { id: 'ev-2', expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    ]);

    const result = await verifyRequiredEvidence(prisma, ['ev-1', 'ev-2'], now);

    expect(evidence.findMany).toHaveBeenCalledWith({ where: { id: { in: ['ev-1', 'ev-2'] } } });
    expect(result).toEqual({ allPresent: false, missingIds: [], expiredIds: ['ev-2'] });
  });

  it('flags a required evidence id that does not exist as missing', async () => {
    const { prisma, evidence } = createMockPrisma();
    evidence.findMany.mockResolvedValue([]);

    const result = await verifyRequiredEvidence(prisma, ['ev-ghost']);

    expect(result).toEqual({ allPresent: false, missingIds: ['ev-ghost'], expiredIds: [] });
  });
});
