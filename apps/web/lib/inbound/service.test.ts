import { createHmac } from 'node:crypto';
import { Prisma, type PrismaClient } from '@sinal/db';
import { describe, expect, it, vi } from 'vitest';
import { processInboundWebhook } from './service';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
}

const SECRET = 'test-webhook-secret';

const VALID_BODY = {
  provider: 'email-relay',
  eventId: 'evt-1',
  channel: 'EMAIL',
  address: 'jane@acme.com',
  receivedAt: '2026-08-11T12:00:00.000Z',
  rawContent: 'Please stop emailing me.',
};

function sign(payload: string, timestamp: string): string {
  return createHmac('sha256', SECRET).update(`${timestamp}.${payload}`).digest('hex');
}

function createMockPrisma() {
  const integrationEvent = { create: vi.fn() };
  const contactChannel = { findFirst: vi.fn() };
  const sequenceEnrollment = { findFirst: vi.fn(), updateMany: vi.fn() };
  const leadStateEvent = { create: vi.fn() };
  const inboundMessage = { create: vi.fn() };
  const tx = { sequenceEnrollment, leadStateEvent, inboundMessage };
  const prisma = {
    integrationEvent,
    contactChannel,
    ...tx,
    $transaction: vi.fn(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, integrationEvent, contactChannel, sequenceEnrollment, inboundMessage };
}

function signedParams(body: unknown = VALID_BODY, timestamp = String(Math.floor(Date.now() / 1000))) {
  const rawBody = JSON.stringify(body);
  return { rawBody, signature: sign(rawBody, timestamp), timestamp, secret: SECRET };
}

describe('processInboundWebhook', () => {
  it('rejects an invalid signature without touching the database', async () => {
    const { prisma, integrationEvent } = createMockPrisma();
    const params = signedParams();

    const result = await processInboundWebhook(prisma, { ...params, signature: 'deadbeef'.repeat(8) });

    expect(result).toEqual({ kind: 'UNAUTHORIZED', reason: 'INVALID_SIGNATURE' });
    expect(integrationEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a body that is not valid JSON', async () => {
    const { prisma } = createMockPrisma();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = 'not json';

    const result = await processInboundWebhook(prisma, { rawBody, signature: sign(rawBody, timestamp), timestamp, secret: SECRET });

    expect(result.kind).toBe('INVALID');
  });

  it('rejects a body missing required fields', async () => {
    const { prisma } = createMockPrisma();
    const params = signedParams({ provider: 'email-relay' });

    const result = await processInboundWebhook(prisma, params);
    expect(result.kind).toBe('INVALID');
  });

  it('returns DUPLICATE for a redelivered eventId without touching contact lookup', async () => {
    const { prisma, integrationEvent, contactChannel } = createMockPrisma();
    integrationEvent.create.mockRejectedValue(uniqueConstraintError());

    const result = await processInboundWebhook(prisma, signedParams());

    expect(result).toEqual({ kind: 'DUPLICATE' });
    expect(contactChannel.findFirst).not.toHaveBeenCalled();
  });

  it('returns UNMATCHED_CONTACT when no ContactChannel matches the address', async () => {
    const { prisma, integrationEvent, contactChannel, sequenceEnrollment } = createMockPrisma();
    integrationEvent.create.mockResolvedValue({});
    contactChannel.findFirst.mockResolvedValue(null);

    const result = await processInboundWebhook(prisma, signedParams());

    expect(result).toEqual({ kind: 'UNMATCHED_CONTACT' });
    expect(sequenceEnrollment.findFirst).not.toHaveBeenCalled();
  });

  it('accepts a valid, matched, first-time webhook and pauses+persists atomically', async () => {
    const { prisma, integrationEvent, contactChannel, sequenceEnrollment, inboundMessage } = createMockPrisma();
    integrationEvent.create.mockResolvedValue({});
    contactChannel.findFirst.mockResolvedValue({ id: 'channel-1', contactId: 'contact-1' });
    sequenceEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', version: 1 });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });
    inboundMessage.create.mockResolvedValue({ id: 'inbound-1' });

    const result = await processInboundWebhook(prisma, signedParams());

    expect(result).toEqual({ kind: 'ACCEPTED', inboundMessageId: 'inbound-1' });
    expect(inboundMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactId: 'contact-1', rawContent: VALID_BODY.rawContent }) }),
    );
  });
});
