import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { applyReplyClassification, handleInboundMessage } from './inbound-service';

function createMockPrisma() {
  const sequenceEnrollment = { findFirst: vi.fn(), updateMany: vi.fn() };
  const leadStateEvent = { create: vi.fn() };
  const inboundMessage = { create: vi.fn(), update: vi.fn() };
  const suppression = { create: vi.fn() };
  const tx = { sequenceEnrollment, leadStateEvent, inboundMessage, suppression };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, sequenceEnrollment, leadStateEvent, inboundMessage, suppression };
}

describe('handleInboundMessage', () => {
  it('pauses the active enrollment and persists the inbound message atomically', async () => {
    const { prisma, sequenceEnrollment, leadStateEvent, inboundMessage } = createMockPrisma();
    sequenceEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', version: 1 });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });
    inboundMessage.create.mockResolvedValue({ id: 'inbound-1' });

    const result = await handleInboundMessage(prisma, {
      contactId: 'contact-1',
      channel: 'EMAIL',
      rawContent: 'Please stop emailing me',
      receivedAt: new Date('2026-08-11T12:00:00.000Z'),
    });

    expect(result.pausedEnrollmentId).toBe('enrollment-1');
    expect(sequenceEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: 'enrollment-1', version: 1 },
      data: expect.objectContaining({ state: 'PAUSED', version: { increment: 1 } }),
    });
    expect(leadStateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toState: 'PAUSED', contactId: 'contact-1' }) }),
    );
    expect(inboundMessage.create).toHaveBeenCalledWith({
      data: {
        contactId: 'contact-1',
        channel: 'EMAIL',
        rawContent: 'Please stop emailing me',
        receivedAt: new Date('2026-08-11T12:00:00.000Z'),
      },
    });
  });

  it('still persists the inbound message when there is no active enrollment to pause', async () => {
    const { prisma, sequenceEnrollment, leadStateEvent, inboundMessage } = createMockPrisma();
    sequenceEnrollment.findFirst.mockResolvedValue(null);
    inboundMessage.create.mockResolvedValue({ id: 'inbound-1' });

    const result = await handleInboundMessage(prisma, {
      contactId: 'contact-1',
      channel: 'EMAIL',
      rawContent: 'x',
      receivedAt: new Date(),
    });

    expect(result.pausedEnrollmentId).toBeNull();
    expect(sequenceEnrollment.updateMany).not.toHaveBeenCalled();
    expect(leadStateEvent.create).not.toHaveBeenCalled();
    expect(inboundMessage.create).toHaveBeenCalled();
  });

  it('does not report a pause when the CAS update loses a race (version already moved)', async () => {
    const { prisma, sequenceEnrollment, leadStateEvent, inboundMessage } = createMockPrisma();
    sequenceEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', version: 1 });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 0 });
    inboundMessage.create.mockResolvedValue({ id: 'inbound-1' });

    const result = await handleInboundMessage(prisma, {
      contactId: 'contact-1',
      channel: 'EMAIL',
      rawContent: 'x',
      receivedAt: new Date(),
    });

    expect(result.pausedEnrollmentId).toBeNull();
    expect(leadStateEvent.create).not.toHaveBeenCalled();
  });

  it('race: once inbound has paused the enrollment, a scheduler holding the pre-inbound version can no longer CAS-update it', async () => {
    const { prisma, sequenceEnrollment, inboundMessage } = createMockPrisma();
    // Scheduler reads the enrollment first, at version 1, planning to send.
    const schedulerReadVersion = 1;

    // Inbound arrives and wins the race: pauses using the same version 1.
    sequenceEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', version: schedulerReadVersion });
    sequenceEnrollment.updateMany.mockResolvedValueOnce({ count: 1 }); // inbound's pause succeeds
    inboundMessage.create.mockResolvedValue({ id: 'inbound-1' });

    const inboundResult = await handleInboundMessage(prisma, {
      contactId: 'contact-1',
      channel: 'EMAIL',
      rawContent: 'stop contacting me',
      receivedAt: new Date(),
    });
    expect(inboundResult.pausedEnrollmentId).toBe('enrollment-1');

    // The scheduler now attempts its own CAS-guarded send using the STALE
    // version it read before the pause. In a real DB this would be 0 rows
    // affected because the row's version already advanced to 2.
    sequenceEnrollment.updateMany.mockResolvedValueOnce({ count: 0 });
    const schedulerSendAttempt = await sequenceEnrollment.updateMany({
      where: { id: 'enrollment-1', state: 'ACTIVE', version: schedulerReadVersion },
      data: { nextActionAt: new Date() },
    });

    expect(schedulerSendAttempt.count).toBe(0);
  });
});

describe('applyReplyClassification', () => {
  it('persists the classification fields', async () => {
    const { prisma, inboundMessage } = createMockPrisma();
    inboundMessage.update.mockResolvedValue({ id: 'inbound-1', intent: 'REQUEST_INFO' });

    const result = await applyReplyClassification(prisma, {
      inboundMessageId: 'inbound-1',
      contactId: 'contact-1',
      intent: 'REQUEST_INFO',
      sentiment: 'NEUTRAL',
      confidence: 0.9,
      requiresHuman: false,
    });

    expect(result.suppressed).toBe(false);
    expect(inboundMessage.update).toHaveBeenCalledWith({
      where: { id: 'inbound-1' },
      data: { intent: 'REQUEST_INFO', sentiment: 'NEUTRAL', classificationConfidence: 0.9, requiresHuman: false },
    });
  });

  it('includes objection only when provided', async () => {
    const { prisma, inboundMessage } = createMockPrisma();
    inboundMessage.update.mockResolvedValue({});

    await applyReplyClassification(prisma, {
      inboundMessageId: 'inbound-1',
      contactId: 'contact-1',
      intent: 'OBJECTION',
      sentiment: 'NEGATIVE',
      objection: 'Too expensive',
      confidence: 0.8,
      requiresHuman: false,
    });

    expect(inboundMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ objection: 'Too expensive' }) }),
    );
  });

  it('suppresses the contact when intent is OPT_OUT', async () => {
    const { prisma, inboundMessage, suppression, sequenceEnrollment } = createMockPrisma();
    inboundMessage.update.mockResolvedValue({ id: 'inbound-1' });
    suppression.create.mockResolvedValue({ id: 'sup-1' });
    sequenceEnrollment.updateMany.mockResolvedValue({ count: 1 });

    const result = await applyReplyClassification(prisma, {
      inboundMessageId: 'inbound-1',
      contactId: 'contact-1',
      intent: 'OPT_OUT',
      sentiment: 'NEGATIVE',
      confidence: 0.95,
      requiresHuman: true,
    });

    expect(result.suppressed).toBe(true);
    expect(suppression.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scope: 'CONTACT', contactId: 'contact-1' }) }),
    );
  });

  it('does not suppress for a non-opt-out intent', async () => {
    const { prisma, inboundMessage, suppression } = createMockPrisma();
    inboundMessage.update.mockResolvedValue({});

    await applyReplyClassification(prisma, {
      inboundMessageId: 'inbound-1',
      contactId: 'contact-1',
      intent: 'POSITIVE_REPLY',
      sentiment: 'POSITIVE',
      confidence: 0.9,
      requiresHuman: false,
    });

    expect(suppression.create).not.toHaveBeenCalled();
  });
});
