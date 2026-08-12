import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createApproval, decideApproval, listPendingApprovals } from './approval-service';

function createMockPrisma() {
  const approval = { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn() };
  return { prisma: { approval } as unknown as PrismaClient, approval };
}

describe('listPendingApprovals', () => {
  it('queries only PENDING approvals ordered by risk then age, with a default limit', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findMany.mockResolvedValue([{ id: 'approval-1' }]);

    const result = await listPendingApprovals(prisma);

    expect(approval.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      orderBy: [{ riskLevel: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    });
    expect(result).toEqual([{ id: 'approval-1' }]);
  });

  it('honors a custom limit', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findMany.mockResolvedValue([]);

    await listPendingApprovals(prisma, { limit: 5 });

    expect(approval.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});

function pendingApproval(overrides: Record<string, unknown> = {}) {
  return {
    id: 'approval-1',
    status: 'PENDING',
    expiresAt: null,
    ...overrides,
  };
}

describe('createApproval', () => {
  it('creates with only the required fields when optionals are omitted', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.create.mockResolvedValue({ id: 'approval-1' });

    await createApproval(prisma, {
      actionType: 'SEND_FIRST_TOUCH',
      entityType: 'MESSAGE',
      entityId: 'draft-1',
      payload: { subject: 'Hi' },
      riskLevel: 'YELLOW',
      rationale: 'First touch requires approval',
    });

    expect(approval.create).toHaveBeenCalledWith({
      data: {
        actionType: 'SEND_FIRST_TOUCH',
        entityType: 'MESSAGE',
        entityId: 'draft-1',
        payload: { subject: 'Hi' },
        riskLevel: 'YELLOW',
        rationale: 'First touch requires approval',
      },
    });
  });

  it('includes optional fields when provided', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.create.mockResolvedValue({ id: 'approval-1' });
    const expiresAt = new Date('2026-09-01T00:00:00.000Z');

    await createApproval(prisma, {
      actionType: 'SEND_FIRST_TOUCH',
      entityType: 'MESSAGE',
      entityId: 'draft-1',
      payload: {},
      riskLevel: 'YELLOW',
      rationale: 'x',
      confidence: 0.82,
      messageDraftId: 'draft-1',
      expiresAt,
    });

    expect(approval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ confidence: 0.82, messageDraftId: 'draft-1', expiresAt }),
    });
  });
});

describe('decideApproval', () => {
  it('returns NOT_FOUND for a missing approval', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValue(null);

    const result = await decideApproval(prisma, {
      approvalId: 'missing',
      reviewerUserId: 'user-1',
      decision: 'APPROVE',
    });
    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });

  it('approves a pending approval and records reviewer/decisionAt', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValueOnce(pendingApproval());
    approval.updateMany.mockResolvedValue({ count: 1 });
    approval.findUniqueOrThrow.mockResolvedValue(pendingApproval({ status: 'APPROVED' }));

    const result = await decideApproval(prisma, {
      approvalId: 'approval-1',
      reviewerUserId: 'user-1',
      decision: 'APPROVE',
    });

    expect(result.kind).toBe('DECIDED');
    expect(approval.updateMany).toHaveBeenCalledWith({
      where: { id: 'approval-1', status: 'PENDING' },
      data: { status: 'APPROVED', reviewerUserId: 'user-1', decisionAt: expect.any(Date) },
    });
  });

  it('stores editedPayload for an EDIT decision', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValueOnce(pendingApproval());
    approval.updateMany.mockResolvedValue({ count: 1 });
    approval.findUniqueOrThrow.mockResolvedValue(pendingApproval({ status: 'EDITED' }));

    await decideApproval(prisma, {
      approvalId: 'approval-1',
      reviewerUserId: 'user-1',
      decision: 'EDIT',
      editedPayload: { subject: 'Edited subject' },
    });

    expect(approval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EDITED', editedPayload: { subject: 'Edited subject' } }) }),
    );
  });

  it('stores decisionReason for a REJECT decision', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValueOnce(pendingApproval());
    approval.updateMany.mockResolvedValue({ count: 1 });
    approval.findUniqueOrThrow.mockResolvedValue(pendingApproval({ status: 'REJECTED' }));

    await decideApproval(prisma, {
      approvalId: 'approval-1',
      reviewerUserId: 'user-1',
      decision: 'REJECT',
      reason: 'Not aligned with ICP',
    });

    expect(approval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED', decisionReason: 'Not aligned with ICP' }) }),
    );
  });

  it('returns CONFLICT without updating when the approval was already decided', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValue(pendingApproval({ status: 'APPROVED' }));

    const result = await decideApproval(prisma, {
      approvalId: 'approval-1',
      reviewerUserId: 'user-1',
      decision: 'REJECT',
    });

    expect(result).toEqual({ kind: 'CONFLICT', currentStatus: 'APPROVED' });
    expect(approval.updateMany).not.toHaveBeenCalled();
  });

  it('sweeps an expired PENDING approval to EXPIRED and returns CONFLICT', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValue(pendingApproval({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }));
    approval.updateMany.mockResolvedValue({ count: 1 });

    const result = await decideApproval(prisma, {
      approvalId: 'approval-1',
      reviewerUserId: 'user-1',
      decision: 'APPROVE',
    });

    expect(result).toEqual({ kind: 'CONFLICT', currentStatus: 'EXPIRED' });
    expect(approval.updateMany).toHaveBeenCalledWith({
      where: { id: 'approval-1', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  });

  it('returns CONFLICT when a concurrent decision wins the CAS race', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValueOnce(pendingApproval());
    approval.updateMany.mockResolvedValue({ count: 0 });
    approval.findUnique.mockResolvedValueOnce(pendingApproval({ status: 'REJECTED' }));

    const result = await decideApproval(prisma, {
      approvalId: 'approval-1',
      reviewerUserId: 'user-1',
      decision: 'APPROVE',
    });

    expect(result).toEqual({ kind: 'CONFLICT', currentStatus: 'REJECTED' });
  });
});
