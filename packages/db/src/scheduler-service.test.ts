import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { claimDueEnrollment, findDueEnrollments } from './scheduler-service';

function createMockPrisma() {
  const sequenceEnrollment = { findMany: vi.fn(), updateMany: vi.fn() };
  const touchpoint = { count: vi.fn() };
  return { prisma: { sequenceEnrollment, touchpoint } as unknown as PrismaClient, sequenceEnrollment, touchpoint };
}

const NOW = new Date('2026-08-11T12:00:00.000Z');

describe('findDueEnrollments', () => {
  it('only ever queries state=ACTIVE enrollments with a due nextActionAt', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findMany.mockResolvedValue([]);

    await findDueEnrollments(prisma, { now: NOW });

    expect(sequenceEnrollment.findMany).toHaveBeenCalledWith({
      where: { state: 'ACTIVE', nextActionAt: { lte: NOW } },
      orderBy: { nextActionAt: 'asc' },
      take: 50,
    });
  });

  it('honors a custom limit', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findMany.mockResolvedValue([]);

    await findDueEnrollments(prisma, { now: NOW, limit: 10 });

    expect(sequenceEnrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('returns whatever rows the query yields (PAUSED/CANCELLED/SUPPRESSED are excluded by the WHERE clause, not filtered here)', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.findMany.mockResolvedValue([{ id: 'enrollment-1', state: 'ACTIVE' }]);

    const result = await findDueEnrollments(prisma, { now: NOW });
    expect(result).toEqual([{ id: 'enrollment-1', state: 'ACTIVE' }]);
  });
});

describe('claimDueEnrollment', () => {
  it('claims the enrollment and advances currentStep/nextActionAt/version', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });
    const nextActionAt = new Date('2026-08-12T12:00:00.000Z');

    const outcome = await claimDueEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      contactId: 'contact-1',
      expectedVersion: 1,
      nextActionAt,
    });

    expect(outcome).toBe('CLAIMED');
    expect(sequenceEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: 'enrollment-1', state: 'ACTIVE', version: 1 },
      data: { currentStep: { increment: 1 }, nextActionAt, version: { increment: 1 } },
    });
  });

  it('returns CONFLICT when the version has already moved (e.g. inbound paused it first)', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 0 });

    const outcome = await claimDueEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      contactId: 'contact-1',
      expectedVersion: 1,
      nextActionAt: null,
    });

    expect(outcome).toBe('CONFLICT');
  });

  it('race: inbound pausing the enrollment first makes the scheduler CAS-claim fail', async () => {
    const { prisma, sequenceEnrollment } = createMockPrisma();
    // Scheduler read the enrollment at version 1. Before it claims, inbound
    // arrives and bumps it to version 2 via its own CAS update (simulated
    // here by making the scheduler's claim at version 1 affect zero rows).
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 0 });

    const outcome = await claimDueEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      contactId: 'contact-1',
      expectedVersion: 1,
      nextActionAt: new Date(),
    });

    expect(outcome).toBe('CONFLICT');
  });

  it('returns CAP_EXCEEDED and never claims when the daily per-contact cap is already met', async () => {
    const { prisma, sequenceEnrollment, touchpoint } = createMockPrisma();
    touchpoint.count.mockResolvedValue(1);

    const outcome = await claimDueEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      contactId: 'contact-1',
      expectedVersion: 1,
      nextActionAt: new Date(),
      frequencyCapPerContactPerDay: 1,
    });

    expect(outcome).toBe('CAP_EXCEEDED');
    expect(sequenceEnrollment.updateMany).not.toHaveBeenCalled();
  });

  it('claims normally when under the daily cap', async () => {
    const { prisma, sequenceEnrollment, touchpoint } = createMockPrisma();
    touchpoint.count.mockResolvedValue(0);
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await claimDueEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      contactId: 'contact-1',
      expectedVersion: 1,
      nextActionAt: new Date(),
      frequencyCapPerContactPerDay: 1,
    });

    expect(outcome).toBe('CLAIMED');
  });

  it('skips the cap check entirely when no cap is configured', async () => {
    const { prisma, sequenceEnrollment, touchpoint } = createMockPrisma();
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });

    await claimDueEnrollment(prisma, {
      enrollmentId: 'enrollment-1',
      contactId: 'contact-1',
      expectedVersion: 1,
      nextActionAt: new Date(),
    });

    expect(touchpoint.count).not.toHaveBeenCalled();
  });
});
