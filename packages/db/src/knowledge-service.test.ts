import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  approveKnowledgeItem,
  createKnowledgeItem,
  createKnowledgeItemVersion,
  deprecateKnowledgeItem,
  listUsableKnowledgeItems,
} from './knowledge-service';

function createMockPrisma() {
  const knowledgeItem = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  };
  return { prisma: { knowledgeItem } as unknown as PrismaClient, knowledgeItem };
}

describe('createKnowledgeItem', () => {
  it('always starts DRAFT at version 1', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.create.mockResolvedValue({ id: 'item-1' });

    await createKnowledgeItem(prisma, { type: 'PRODUCT_TRUTH', title: 'Feature X', content: 'Feature X does Y' });

    expect(knowledgeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvalState: 'DRAFT', version: 1 }) }),
    );
  });
});

describe('approveKnowledgeItem', () => {
  it('returns NOT_FOUND for a missing item', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findUnique.mockResolvedValue(null);

    const result = await approveKnowledgeItem(prisma, { id: 'x', approvedByUserId: 'user-1' });

    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });

  it('returns CONFLICT when the item is not DRAFT', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findUnique.mockResolvedValue({ id: 'item-1', approvalState: 'DEPRECATED' });

    const result = await approveKnowledgeItem(prisma, { id: 'item-1', approvedByUserId: 'user-1' });

    expect(result).toEqual({ kind: 'CONFLICT', currentState: 'DEPRECATED' });
    expect(knowledgeItem.updateMany).not.toHaveBeenCalled();
  });

  it('approves a DRAFT item and records the approver', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findUnique.mockResolvedValue({ id: 'item-1', approvalState: 'DRAFT' });
    knowledgeItem.updateMany.mockResolvedValue({ count: 1 });
    knowledgeItem.findUniqueOrThrow.mockResolvedValue({ id: 'item-1', approvalState: 'APPROVED' });

    const result = await approveKnowledgeItem(prisma, { id: 'item-1', approvedByUserId: 'user-1' });

    expect(result).toEqual({ kind: 'UPDATED', item: { id: 'item-1', approvalState: 'APPROVED' } });
    expect(knowledgeItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1', approvalState: 'DRAFT' },
        data: expect.objectContaining({ approvalState: 'APPROVED', approvedBy: 'user-1' }),
      }),
    );
  });
});

describe('deprecateKnowledgeItem', () => {
  it('rejects deprecating a DRAFT item (only APPROVED can be deprecated)', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findUnique.mockResolvedValue({ id: 'item-1', approvalState: 'DRAFT' });

    const result = await deprecateKnowledgeItem(prisma, { id: 'item-1' });

    expect(result).toEqual({ kind: 'CONFLICT', currentState: 'DRAFT' });
    expect(knowledgeItem.updateMany).not.toHaveBeenCalled();
  });

  it('deprecates an APPROVED item', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findUnique.mockResolvedValue({ id: 'item-1', approvalState: 'APPROVED' });
    knowledgeItem.updateMany.mockResolvedValue({ count: 1 });
    knowledgeItem.findUniqueOrThrow.mockResolvedValue({ id: 'item-1', approvalState: 'DEPRECATED' });

    const result = await deprecateKnowledgeItem(prisma, { id: 'item-1' });

    expect(result).toEqual({ kind: 'UPDATED', item: { id: 'item-1', approvalState: 'DEPRECATED' } });
  });
});

describe('createKnowledgeItemVersion', () => {
  it('creates a new DRAFT row at version+1 without mutating the source row', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findUnique.mockResolvedValue({
      id: 'item-1',
      type: 'PRICING_PACKAGING',
      title: 'Pricing v1',
      tags: ['pricing'],
      sourceRef: 'doc-1',
      jurisdiction: 'BR',
      version: 3,
      approvalState: 'APPROVED',
    });
    knowledgeItem.create.mockResolvedValue({ id: 'item-2' });

    const result = await createKnowledgeItemVersion(prisma, { id: 'item-1', content: 'Updated pricing' });

    expect(result.kind).toBe('CREATED');
    expect(knowledgeItem.updateMany).not.toHaveBeenCalled();
    expect(knowledgeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 4, approvalState: 'DRAFT', content: 'Updated pricing', title: 'Pricing v1' }),
      }),
    );
  });

  it('returns NOT_FOUND when versioning from a nonexistent item', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findUnique.mockResolvedValue(null);

    const result = await createKnowledgeItemVersion(prisma, { id: 'missing', content: 'x' });

    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });
});

describe('listUsableKnowledgeItems', () => {
  it('queries only APPROVED rows and re-filters by validity at read time', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findMany.mockResolvedValue([
      { id: 'usable', approvalState: 'APPROVED', validFrom: null, validUntil: null },
      { id: 'expired', approvalState: 'APPROVED', validFrom: null, validUntil: new Date('2026-01-01T00:00:00.000Z') },
    ]);

    const result = await listUsableKnowledgeItems(prisma, { now });

    expect(knowledgeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ approvalState: 'APPROVED' }) }),
    );
    expect(result.map((r) => r.id)).toEqual(['usable']);
  });

  it('filters by knowledge type when provided', async () => {
    const { prisma, knowledgeItem } = createMockPrisma();
    knowledgeItem.findMany.mockResolvedValue([]);

    await listUsableKnowledgeItems(prisma, { type: 'LEGAL_COMPLIANCE' });

    expect(knowledgeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'LEGAL_COMPLIANCE' }) }),
    );
  });
});
