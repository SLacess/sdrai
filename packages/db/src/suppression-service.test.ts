import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { isSuppressed, suppressContact } from './suppression-service';

function createMockPrisma() {
  const suppression = { findFirst: vi.fn(), create: vi.fn() };
  const sequenceEnrollment = { updateMany: vi.fn() };
  const tx = { suppression, sequenceEnrollment };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, suppression, sequenceEnrollment };
}

const NOW = new Date('2026-08-11T12:00:00.000Z');

describe('isSuppressed', () => {
  it('returns false and skips the query when no scope params are provided', async () => {
    const { prisma, suppression } = createMockPrisma();
    expect(await isSuppressed(prisma, {}, NOW)).toBe(false);
    expect(suppression.findFirst).not.toHaveBeenCalled();
  });

  it('returns true when a matching unexpired suppression exists', async () => {
    const { prisma, suppression } = createMockPrisma();
    suppression.findFirst.mockResolvedValue({ id: 'sup-1' });

    expect(await isSuppressed(prisma, { contactId: 'contact-1' }, NOW)).toBe(true);
    expect(suppression.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ scope: 'CONTACT', contactId: 'contact-1' }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] }],
      },
    });
  });

  it('returns false when no suppression matches', async () => {
    const { prisma, suppression } = createMockPrisma();
    suppression.findFirst.mockResolvedValue(null);
    expect(await isSuppressed(prisma, { contactId: 'contact-1' }, NOW)).toBe(false);
  });

  it('checks all provided scopes together via OR', async () => {
    const { prisma, suppression } = createMockPrisma();
    suppression.findFirst.mockResolvedValue(null);

    await isSuppressed(prisma, { contactId: 'contact-1', accountId: 'acc-1', address: 'jane@acme.com', domain: 'acme.com' }, NOW);

    expect(suppression.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { scope: 'CONTACT', contactId: 'contact-1' },
            { scope: 'ACCOUNT', accountId: 'acc-1' },
            { scope: 'ADDRESS', address: 'jane@acme.com' },
            { scope: 'DOMAIN', domain: 'acme.com' },
          ],
        }),
      }),
    );
  });
});

describe('suppressContact', () => {
  it('creates the suppression and cancels active/paused enrollments for the contact', async () => {
    const { prisma, suppression, sequenceEnrollment } = createMockPrisma();
    suppression.create.mockResolvedValue({ id: 'sup-1' });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 2 });

    const result = await suppressContact(prisma, {
      scope: 'CONTACT',
      contactId: 'contact-1',
      reason: 'opt-out',
      source: 'reply_classifier',
    });

    expect(result).toEqual({ suppression: { id: 'sup-1' }, cancelledEnrollments: 2 });
    expect(sequenceEnrollment.updateMany).toHaveBeenCalledWith({
      where: { contactId: 'contact-1', state: { in: ['ACTIVE', 'PAUSED'] } },
      data: { state: 'SUPPRESSED', pausedAt: expect.any(Date), pauseReason: 'opt-out' },
    });
  });

  it('does not touch enrollments when no contactId is given (e.g. domain-level suppression)', async () => {
    const { prisma, suppression, sequenceEnrollment } = createMockPrisma();
    suppression.create.mockResolvedValue({ id: 'sup-1' });

    const result = await suppressContact(prisma, {
      scope: 'DOMAIN',
      domain: 'acme.com',
      reason: 'bulk unsubscribe',
      source: 'manual',
    });

    expect(sequenceEnrollment.updateMany).not.toHaveBeenCalled();
    expect(result.cancelledEnrollments).toBe(0);
  });

  it('only includes optional fields when provided', async () => {
    const { prisma, suppression, sequenceEnrollment } = createMockPrisma();
    suppression.create.mockResolvedValue({ id: 'sup-1' });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 0 });

    await suppressContact(prisma, { scope: 'CONTACT', contactId: 'contact-1', reason: 'x', source: 'y' });

    expect(suppression.create).toHaveBeenCalledWith({
      data: { scope: 'CONTACT', reason: 'x', source: 'y', contactId: 'contact-1' },
    });
  });
});
