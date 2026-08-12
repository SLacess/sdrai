import type { PrismaClient } from '@prisma/client';
import { InvalidTransitionError } from '@sinal/domain';
import { describe, expect, it, vi } from 'vitest';
import { OptimisticConcurrencyError, transitionEntityState } from './state-transition';

type MockTx = {
  account: { updateMany: ReturnType<typeof vi.fn> };
  contact: { updateMany: ReturnType<typeof vi.fn> };
  opportunity: { updateMany: ReturnType<typeof vi.fn> };
  leadStateEvent: { create: ReturnType<typeof vi.fn> };
};

function createMockPrisma() {
  const tx: MockTx = {
    account: { updateMany: vi.fn() },
    contact: { updateMany: vi.fn() },
    opportunity: { updateMany: vi.fn() },
    leadStateEvent: { create: vi.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (transactionClient: MockTx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, tx };
}

describe('transitionEntityState', () => {
  it('applies a valid ACCOUNT transition via CAS and writes an append-only event', async () => {
    const { prisma, tx } = createMockPrisma();
    tx.account.updateMany.mockResolvedValue({ count: 1 });
    tx.leadStateEvent.create.mockResolvedValue({});

    await transitionEntityState(prisma, {
      entity: 'ACCOUNT',
      id: 'acc-1',
      from: 'DISCOVERED',
      to: 'RESEARCHING',
      reason: 'Research job started',
      actorType: 'AGENT',
    });

    expect(tx.account.updateMany).toHaveBeenCalledWith({
      where: { id: 'acc-1', status: 'DISCOVERED' },
      data: { status: 'RESEARCHING' },
    });
    expect(tx.leadStateEvent.create).toHaveBeenCalledWith({
      data: {
        entityType: 'ACCOUNT',
        entityId: 'acc-1',
        fromState: 'DISCOVERED',
        toState: 'RESEARCHING',
        reason: 'Research job started',
        actorType: 'AGENT',
        accountId: 'acc-1',
      },
    });
  });

  it('applies a valid CONTACT transition against leadState', async () => {
    const { prisma, tx } = createMockPrisma();
    tx.contact.updateMany.mockResolvedValue({ count: 1 });
    tx.leadStateEvent.create.mockResolvedValue({});

    await transitionEntityState(prisma, {
      entity: 'CONTACT',
      id: 'contact-1',
      from: 'IDENTIFIED',
      to: 'VERIFIED',
      reason: 'Email verified',
      actorType: 'SYSTEM',
    });

    expect(tx.contact.updateMany).toHaveBeenCalledWith({
      where: { id: 'contact-1', leadState: 'IDENTIFIED' },
      data: { leadState: 'VERIFIED' },
    });
    expect(tx.leadStateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entityType: 'CONTACT', contactId: 'contact-1' }) }),
    );
  });

  it('applies a valid OPPORTUNITY transition against stage', async () => {
    const { prisma, tx } = createMockPrisma();
    tx.opportunity.updateMany.mockResolvedValue({ count: 1 });
    tx.leadStateEvent.create.mockResolvedValue({});

    await transitionEntityState(prisma, {
      entity: 'OPPORTUNITY',
      id: 'opp-1',
      from: 'PRE_OPPORTUNITY',
      to: 'QUALIFIED_OPPORTUNITY',
      reason: 'SQL criteria met',
      actorType: 'AGENT',
    });

    expect(tx.opportunity.updateMany).toHaveBeenCalledWith({
      where: { id: 'opp-1', stage: 'PRE_OPPORTUNITY' },
      data: { stage: 'QUALIFIED_OPPORTUNITY' },
    });
  });

  it('includes actorId and metadata only when provided', async () => {
    const { prisma, tx } = createMockPrisma();
    tx.account.updateMany.mockResolvedValue({ count: 1 });
    tx.leadStateEvent.create.mockResolvedValue({});

    await transitionEntityState(prisma, {
      entity: 'ACCOUNT',
      id: 'acc-1',
      from: 'DISCOVERED',
      to: 'RESEARCHING',
      reason: 'Research job started',
      actorType: 'USER',
      actorId: 'user-1',
      metadata: { jobId: 'job-1' },
    });

    expect(tx.leadStateEvent.create).toHaveBeenCalledWith({
      data: {
        entityType: 'ACCOUNT',
        entityId: 'acc-1',
        fromState: 'DISCOVERED',
        toState: 'RESEARCHING',
        reason: 'Research job started',
        actorType: 'USER',
        actorId: 'user-1',
        metadata: { jobId: 'job-1' },
        accountId: 'acc-1',
      },
    });
  });

  it('rejects an invalid transition without touching the database', async () => {
    const { prisma, tx } = createMockPrisma();

    await expect(
      transitionEntityState(prisma, {
        entity: 'ACCOUNT',
        id: 'acc-1',
        from: 'DISCOVERED',
        to: 'QUALIFIED_ACCOUNT',
        reason: 'skip ahead',
        actorType: 'AGENT',
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.account.updateMany).not.toHaveBeenCalled();
  });

  it('raises OptimisticConcurrencyError when the CAS update matches zero rows, and never writes the event', async () => {
    const { prisma, tx } = createMockPrisma();
    tx.account.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      transitionEntityState(prisma, {
        entity: 'ACCOUNT',
        id: 'acc-1',
        from: 'DISCOVERED',
        to: 'RESEARCHING',
        reason: 'Research job started',
        actorType: 'AGENT',
      }),
    ).rejects.toBeInstanceOf(OptimisticConcurrencyError);

    expect(tx.leadStateEvent.create).not.toHaveBeenCalled();
  });
});
