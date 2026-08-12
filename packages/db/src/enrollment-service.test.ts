import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { enrollContact, pauseEnrollment, resumeEnrollment } from './enrollment-service';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
}

function createMockPrisma() {
  const sequenceEnrollment = {
    findFirst: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  };
  const leadStateEvent = { create: vi.fn() };
  const tx = { sequenceEnrollment, leadStateEvent };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, sequenceEnrollment, leadStateEvent };
}

describe('enrollContact', () => {
  it('enrolls a contact with no existing active enrollment', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findFirst.mockResolvedValue(null);
    sequenceEnrollment.create.mockResolvedValue({ id: 'enrollment-1', state: 'ACTIVE' });

    const result = await enrollContact(prisma, { campaignId: 'campaign-1', contactId: 'contact-1' });

    expect(result).toEqual({ kind: 'ENROLLED', enrollment: { id: 'enrollment-1', state: 'ACTIVE' } });
    expect(sequenceEnrollment.create).toHaveBeenCalledWith({
      data: { campaignId: 'campaign-1', contactId: 'contact-1', state: 'ACTIVE' },
    });
  });

  it('returns CONFLICT when the contact already has an active enrollment', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-existing' });

    const result = await enrollContact(prisma, { campaignId: 'campaign-2', contactId: 'contact-1' });

    expect(result).toEqual({ kind: 'CONFLICT', activeEnrollmentId: 'enrollment-existing' });
    expect(sequenceEnrollment.create).not.toHaveBeenCalled();
  });

  it('resolves a create-time race against the partial unique index as CONFLICT', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findFirst.mockResolvedValueOnce(null);
    sequenceEnrollment.create.mockRejectedValueOnce(uniqueConstraintError());
    sequenceEnrollment.findFirst.mockResolvedValueOnce({ id: 'enrollment-raced' });

    const result = await enrollContact(prisma, { campaignId: 'campaign-1', contactId: 'contact-1' });
    expect(result).toEqual({ kind: 'CONFLICT', activeEnrollmentId: 'enrollment-raced' });
  });
});

describe('pauseEnrollment', () => {
  it('pauses an active enrollment and writes an audit event', async () => {
    const { prisma, sequenceEnrollment, leadStateEvent } = createMockPrisma();
    sequenceEnrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', state: 'ACTIVE', version: 1, contactId: 'contact-1' });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });
    sequenceEnrollment.findUniqueOrThrow.mockResolvedValue({ id: 'enrollment-1', state: 'PAUSED' });

    const result = await pauseEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      reason: 'inbound reply received',
      actorType: 'SYSTEM',
    });

    expect(result).toEqual({ kind: 'UPDATED', enrollment: { id: 'enrollment-1', state: 'PAUSED' } });
    expect(sequenceEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: 'enrollment-1', version: 1 },
      data: expect.objectContaining({ state: 'PAUSED', pauseReason: 'inbound reply received', version: { increment: 1 } }),
    });
    expect(leadStateEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'CONTACT',
        entityId: 'contact-1',
        fromState: 'ACTIVE',
        toState: 'PAUSED',
        reason: 'inbound reply received',
        actorType: 'SYSTEM',
        contactId: 'contact-1',
      }),
    });
  });

  it('returns NOT_FOUND for a missing enrollment', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findUnique.mockResolvedValue(null);

    const result = await pauseEnrollment(prisma, { enrollmentId: 'missing', reason: 'x', actorType: 'SYSTEM' });
    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });

  it('returns CONFLICT when the enrollment is not currently ACTIVE', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', state: 'PAUSED', version: 2, contactId: 'contact-1' });

    const result = await pauseEnrollment(prisma, { enrollmentId: 'enrollment-1', reason: 'x', actorType: 'SYSTEM' });
    expect(result).toEqual({ kind: 'CONFLICT' });
  });

  it('returns CONFLICT when the version changed between read and update (lost race)', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', state: 'ACTIVE', version: 1, contactId: 'contact-1' });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 0 });

    const result = await pauseEnrollment(prisma, { enrollmentId: 'enrollment-1', reason: 'x', actorType: 'SYSTEM' });
    expect(result).toEqual({ kind: 'CONFLICT' });
  });
});

describe('resumeEnrollment', () => {
  it('resumes a paused enrollment and clears pause fields', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', state: 'PAUSED', version: 2, contactId: 'contact-1' });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });
    sequenceEnrollment.findUniqueOrThrow.mockResolvedValue({ id: 'enrollment-1', state: 'ACTIVE' });

    const result = await resumeEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      reason: 'manual resume',
      actorType: 'USER',
      actorId: 'user-1',
    });

    expect(result.kind).toBe('UPDATED');
    expect(sequenceEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: 'enrollment-1', version: 2 },
      data: expect.objectContaining({ state: 'ACTIVE', pausedAt: null, pauseReason: null }),
    });
  });

  it('resolves a resume-time race against the partial unique index as CONFLICT', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', state: 'PAUSED', version: 2, contactId: 'contact-1' });
    sequenceEnrollment.updateMany.mockRejectedValue(uniqueConstraintError());

    const result = await resumeEnrollment(prisma, { enrollmentId: 'enrollment-1', reason: 'x', actorType: 'SYSTEM' });
    expect(result).toEqual({ kind: 'CONFLICT' });
  });
});
