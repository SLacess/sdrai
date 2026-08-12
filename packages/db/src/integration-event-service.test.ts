import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { recordIntegrationEvent } from './integration-event-service';

function createMockPrisma() {
  const integrationEvent = { create: vi.fn() };
  return { prisma: { integrationEvent } as unknown as PrismaClient, integrationEvent };
}

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
}

describe('recordIntegrationEvent', () => {
  it('returns NEW and persists the event on first delivery', async () => {
    const { prisma, integrationEvent } = createMockPrisma();
    integrationEvent.create.mockResolvedValue({});

    const outcome = await recordIntegrationEvent(prisma, {
      provider: 'n8n',
      externalId: 'evt-1',
      type: 'workflow.completed',
      payloadHash: 'hash-1',
    });

    expect(outcome).toBe('NEW');
    expect(integrationEvent.create).toHaveBeenCalledWith({
      data: { provider: 'n8n', externalId: 'evt-1', type: 'workflow.completed', payloadHash: 'hash-1', status: 'RECEIVED' },
    });
  });

  it('returns DUPLICATE on a redelivered event id instead of throwing', async () => {
    const { prisma, integrationEvent } = createMockPrisma();
    integrationEvent.create.mockRejectedValue(uniqueConstraintError());

    const outcome = await recordIntegrationEvent(prisma, {
      provider: 'n8n',
      externalId: 'evt-1',
      type: 'workflow.completed',
      payloadHash: 'hash-1',
    });

    expect(outcome).toBe('DUPLICATE');
  });

  it('rethrows a non-unique-constraint error', async () => {
    const { prisma, integrationEvent } = createMockPrisma();
    integrationEvent.create.mockRejectedValue(new Error('db down'));

    await expect(
      recordIntegrationEvent(prisma, { provider: 'n8n', externalId: 'evt-1', type: 'x', payloadHash: 'h' }),
    ).rejects.toThrow('db down');
  });

  it('includes the payload only when provided', async () => {
    const { prisma, integrationEvent } = createMockPrisma();
    integrationEvent.create.mockResolvedValue({});

    await recordIntegrationEvent(prisma, {
      provider: 'hubspot',
      externalId: 'evt-2',
      type: 'contact.updated',
      payloadHash: 'h2',
      payload: { propertyName: 'email' },
    });

    expect(integrationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ payload: { propertyName: 'email' } }),
    });
  });
});
