import type { PrismaClient } from '@sinal/db';
import { describe, expect, it, vi } from 'vitest';
import { describeProposedAction, listInboxThreads } from './service';

function createMockPrisma() {
  const inboundMessage = { findMany: vi.fn() };
  const messageDraft = { findMany: vi.fn().mockResolvedValue([]) };
  return { prisma: { inboundMessage, messageDraft } as unknown as PrismaClient, inboundMessage, messageDraft };
}

function baseMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inbound-1',
    contactId: 'contact-1',
    channel: 'EMAIL',
    rawContent: 'What is your pricing?',
    receivedAt: new Date('2026-08-10T12:00:00.000Z'),
    intent: 'PRICING',
    sentiment: 'NEUTRAL',
    classificationConfidence: 0.9,
    requiresHuman: false,
    contact: { name: 'Jane Doe', account: { id: 'acc-1', brandName: 'Acme' } },
    ...overrides,
  };
}

describe('listInboxThreads', () => {
  it('returns an empty list when there are no inbound messages', async () => {
    const { prisma, inboundMessage, messageDraft } = createMockPrisma();
    inboundMessage.findMany.mockResolvedValue([]);

    const result = await listInboxThreads(prisma);

    expect(result).toEqual([]);
    expect(messageDraft.findMany).not.toHaveBeenCalled();
  });

  it('maps a thread with no proposed draft yet', async () => {
    const { prisma, inboundMessage } = createMockPrisma();
    inboundMessage.findMany.mockResolvedValue([baseMessage()]);

    const result = await listInboxThreads(prisma);

    expect(result).toEqual([
      {
        inboundMessageId: 'inbound-1',
        contactId: 'contact-1',
        contactName: 'Jane Doe',
        accountId: 'acc-1',
        accountName: 'Acme',
        channel: 'EMAIL',
        rawContent: 'What is your pricing?',
        receivedAt: new Date('2026-08-10T12:00:00.000Z'),
        intent: 'PRICING',
        sentiment: 'NEUTRAL',
        classificationConfidence: 0.9,
        requiresHuman: false,
        proposedDraft: null,
      },
    ]);
  });

  it('attaches the most recent draft created at or after the message arrived', async () => {
    const { prisma, inboundMessage, messageDraft } = createMockPrisma();
    inboundMessage.findMany.mockResolvedValue([baseMessage()]);
    messageDraft.findMany.mockResolvedValue([
      {
        id: 'draft-1',
        contactId: 'contact-1',
        status: 'PENDING_APPROVAL',
        riskLevel: 'RED',
        createdAt: new Date('2026-08-10T13:00:00.000Z'),
        approvals: [{ status: 'PENDING' }],
      },
      {
        id: 'draft-stale',
        contactId: 'contact-1',
        status: 'SENT',
        riskLevel: 'YELLOW',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        approvals: [],
      },
    ]);

    const result = await listInboxThreads(prisma);

    expect(result[0]?.proposedDraft).toEqual({
      id: 'draft-1',
      status: 'PENDING_APPROVAL',
      riskLevel: 'RED',
      approvalStatus: 'PENDING',
    });
  });

  it('ignores a draft created before the inbound message arrived', async () => {
    const { prisma, inboundMessage, messageDraft } = createMockPrisma();
    inboundMessage.findMany.mockResolvedValue([baseMessage()]);
    messageDraft.findMany.mockResolvedValue([
      {
        id: 'draft-old',
        contactId: 'contact-1',
        status: 'SENT',
        riskLevel: 'GREEN',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        approvals: [],
      },
    ]);

    const result = await listInboxThreads(prisma);

    expect(result[0]?.proposedDraft).toBeNull();
  });

  it('filters to only threads requiring human attention when requested', async () => {
    const { prisma, inboundMessage } = createMockPrisma();
    inboundMessage.findMany.mockResolvedValue([]);

    await listInboxThreads(prisma, { onlyRequiringHuman: true });

    expect(inboundMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requiresHuman: true } }),
    );
  });
});

describe('describeProposedAction', () => {
  it('returns NO_DRAFT_YET when there is no draft', () => {
    expect(describeProposedAction(null)).toEqual({ kind: 'NO_DRAFT_YET' });
  });

  it('returns PENDING_HUMAN_REVIEW for a Red-risk draft awaiting approval, never a decided/send state', () => {
    const result = describeProposedAction({ id: 'draft-1', status: 'PENDING_APPROVAL', riskLevel: 'RED', approvalStatus: 'PENDING' });
    expect(result).toEqual({ kind: 'PENDING_HUMAN_REVIEW', riskLevel: 'RED', draftStatus: 'PENDING_APPROVAL' });
  });

  it('treats a draft with no approval submitted yet as PENDING_HUMAN_REVIEW too', () => {
    const result = describeProposedAction({ id: 'draft-1', status: 'DRAFT', riskLevel: 'YELLOW', approvalStatus: null });
    expect(result.kind).toBe('PENDING_HUMAN_REVIEW');
  });

  it('returns DECIDED once the approval has a terminal status', () => {
    const result = describeProposedAction({ id: 'draft-1', status: 'APPROVED', riskLevel: 'GREEN', approvalStatus: 'APPROVED' });
    expect(result).toEqual({ kind: 'DECIDED', riskLevel: 'GREEN', draftStatus: 'APPROVED', approvalStatus: 'APPROVED' });
  });

  it('never returns a variant that carries a send action, for any risk level', () => {
    const allowedKeysByKind: Record<string, string[]> = {
      NO_DRAFT_YET: ['kind'],
      PENDING_HUMAN_REVIEW: ['kind', 'riskLevel', 'draftStatus'],
      DECIDED: ['kind', 'riskLevel', 'draftStatus', 'approvalStatus'],
    };
    for (const riskLevel of ['GREEN', 'YELLOW', 'RED']) {
      for (const approvalStatus of [null, 'PENDING', 'APPROVED', 'REJECTED', 'EDITED']) {
        const result = describeProposedAction({ id: 'd', status: 'DRAFT', riskLevel, approvalStatus });
        expect(Object.keys(result).sort()).toEqual([...(allowedKeysByKind[result.kind] ?? [])].sort());
      }
    }
  });
});
