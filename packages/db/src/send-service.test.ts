import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { sendEmailIdempotent, type EmailSender } from './send-service';

function createMockPrisma() {
  const idempotencyRecord = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
  return { prisma: { idempotencyRecord } as unknown as PrismaClient, idempotencyRecord };
}

function createMockSender() {
  const send = vi.fn().mockResolvedValue({ providerMessageId: 'provider-msg-1' });
  return { sender: { send } as EmailSender, send };
}

const PARAMS = { idempotencyKey: 'key-1', to: 'jane@acme.com', subject: 'Hi', body: 'Hello Jane' };

describe('sendEmailIdempotent', () => {
  it('reserves the key, calls the provider, and completes the record on first send', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue(null);
    idempotencyRecord.create.mockResolvedValue({});
    idempotencyRecord.update.mockResolvedValue({});
    const { sender, send } = createMockSender();

    const outcome = await sendEmailIdempotent(prisma, sender, PARAMS);

    expect(outcome).toEqual({ kind: 'SENT', providerMessageId: 'provider-msg-1' });
    expect(send).toHaveBeenCalledWith({ to: 'jane@acme.com', subject: 'Hi', body: 'Hello Jane' });
    expect(idempotencyRecord.update).toHaveBeenCalledWith({
      where: { key: 'key-1' },
      data: { status: 'COMPLETED', responseJson: { providerMessageId: 'provider-msg-1' } },
    });
  });

  it('does not call the provider again on a retry with the same key and payload', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    const { sender, send } = createMockSender();

    // Compute the exact hash the service will derive so the mock matches.
    const { computeRequestHash } = await import('./idempotency-service');
    const requestHash = computeRequestHash({ to: PARAMS.to, subject: PARAMS.subject, body: PARAMS.body });
    idempotencyRecord.findUnique.mockResolvedValue({
      requestHash,
      status: 'COMPLETED',
      responseJson: { providerMessageId: 'provider-msg-1' },
    });

    const outcome = await sendEmailIdempotent(prisma, sender, PARAMS);

    expect(outcome).toEqual({ kind: 'DUPLICATE', providerMessageId: 'provider-msg-1' });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns DUPLICATE with a null providerMessageId when the prior attempt is still in flight', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    const { computeRequestHash } = await import('./idempotency-service');
    const requestHash = computeRequestHash({ to: PARAMS.to, subject: PARAMS.subject, body: PARAMS.body });
    idempotencyRecord.findUnique.mockResolvedValue({ requestHash, status: 'IN_PROGRESS', responseJson: null });
    const { sender, send } = createMockSender();

    const outcome = await sendEmailIdempotent(prisma, sender, PARAMS);

    expect(outcome).toEqual({ kind: 'DUPLICATE', providerMessageId: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns CONFLICT and never calls the provider when the same key is reused with a different payload', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: 'some-other-hash',
      status: 'COMPLETED',
      responseJson: { providerMessageId: 'provider-msg-old' },
    });
    const { sender, send } = createMockSender();

    const outcome = await sendEmailIdempotent(prisma, sender, PARAMS);

    expect(outcome).toEqual({ kind: 'CONFLICT' });
    expect(send).not.toHaveBeenCalled();
  });
});
