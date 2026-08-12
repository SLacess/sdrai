import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { processSendApproved } from './send-approved-service';
import type { EmailSender } from './send-service';

function createMockPrisma() {
  const approval = { findUnique: vi.fn() };
  const messageDraft = { findUniqueOrThrow: vi.fn(), update: vi.fn() };
  const suppression = { findFirst: vi.fn() };
  const inboundMessage = { findFirst: vi.fn() };
  const idempotencyRecord = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
  const touchpoint = { create: vi.fn() };
  const prisma = { approval, messageDraft, suppression, inboundMessage, idempotencyRecord, touchpoint };
  return { prisma: prisma as unknown as PrismaClient, ...prisma };
}

function createMockSender(providerMessageId = 'provider-msg-1') {
  const send = vi.fn().mockResolvedValue({ providerMessageId });
  return { sender: { send } as EmailSender, send };
}

const APPROVED_APPROVAL = {
  id: 'approval-1',
  status: 'APPROVED',
  messageDraftId: 'draft-1',
  decisionAt: new Date('2026-08-11T10:00:00.000Z'),
  createdAt: new Date('2026-08-11T09:00:00.000Z'),
  editedPayload: null,
};

const DRAFT = {
  id: 'draft-1',
  contactId: 'contact-1',
  body: 'Original body',
  subject: 'Original subject',
};

describe('processSendApproved', () => {
  it('returns NOT_FOUND for a missing approval', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValue(null);
    const { sender } = createMockSender();

    const result = await processSendApproved(prisma, sender, { approvalId: 'x', channel: 'EMAIL', toAddress: 'a@b.com' });
    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });

  it('returns INVALID_APPROVAL_STATE when the approval is not APPROVED/EDITED', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValue({ ...APPROVED_APPROVAL, status: 'PENDING' });
    const { sender, send } = createMockSender();

    const result = await processSendApproved(prisma, sender, { approvalId: 'approval-1', channel: 'EMAIL', toAddress: 'a@b.com' });
    expect(result).toEqual({ kind: 'INVALID_APPROVAL_STATE', status: 'PENDING' });
    expect(send).not.toHaveBeenCalled();
  });

  it('blocks and cancels the draft when the contact is suppressed', async () => {
    const { prisma, approval, messageDraft, suppression } = createMockPrisma();
    approval.findUnique.mockResolvedValue(APPROVED_APPROVAL);
    messageDraft.findUniqueOrThrow.mockResolvedValue(DRAFT);
    suppression.findFirst.mockResolvedValue({ id: 'sup-1' });
    const { sender, send } = createMockSender();

    const result = await processSendApproved(prisma, sender, { approvalId: 'approval-1', channel: 'EMAIL', toAddress: 'a@b.com' });

    expect(result).toEqual({ kind: 'BLOCKED', reason: 'Contact is suppressed' });
    expect(send).not.toHaveBeenCalled();
    expect(messageDraft.update).toHaveBeenCalledWith({ where: { id: 'draft-1' }, data: { status: 'CANCELLED' } });
  });

  it('blocks when a reply arrived after the approval decision', async () => {
    const { prisma, approval, messageDraft, suppression, inboundMessage } = createMockPrisma();
    approval.findUnique.mockResolvedValue(APPROVED_APPROVAL);
    messageDraft.findUniqueOrThrow.mockResolvedValue(DRAFT);
    suppression.findFirst.mockResolvedValue(null);
    inboundMessage.findFirst.mockResolvedValue({ id: 'inbound-1' });
    const { sender, send } = createMockSender();

    const result = await processSendApproved(prisma, sender, { approvalId: 'approval-1', channel: 'EMAIL', toAddress: 'a@b.com' });

    expect(result).toEqual({ kind: 'BLOCKED', reason: 'New inbound reply received since approval' });
    expect(send).not.toHaveBeenCalled();
    expect(inboundMessage.findFirst).toHaveBeenCalledWith({
      where: { contactId: 'contact-1', receivedAt: { gt: APPROVED_APPROVAL.decisionAt } },
    });
  });

  it('sends, creates a Touchpoint, and marks the draft SENT on the clear happy path', async () => {
    const { prisma, approval, messageDraft, suppression, inboundMessage, idempotencyRecord, touchpoint } = createMockPrisma();
    approval.findUnique.mockResolvedValue(APPROVED_APPROVAL);
    messageDraft.findUniqueOrThrow.mockResolvedValue(DRAFT);
    suppression.findFirst.mockResolvedValue(null);
    inboundMessage.findFirst.mockResolvedValue(null);
    idempotencyRecord.findUnique.mockResolvedValue(null);
    idempotencyRecord.create.mockResolvedValue({});
    idempotencyRecord.update.mockResolvedValue({});
    touchpoint.create.mockResolvedValue({ id: 'touchpoint-1' });
    const { sender, send } = createMockSender('provider-msg-1');

    const result = await processSendApproved(prisma, sender, { approvalId: 'approval-1', channel: 'EMAIL', toAddress: 'jane@acme.com' });

    expect(result).toEqual({ kind: 'SENT', touchpointId: 'touchpoint-1', providerMessageId: 'provider-msg-1' });
    expect(send).toHaveBeenCalledWith({ to: 'jane@acme.com', subject: 'Original subject', body: 'Original body' });
    expect(touchpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: 'contact-1',
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          status: 'SENT',
          providerId: 'provider-msg-1',
          idempotencyKey: 'send-touchpoint:draft-1',
        }),
      }),
    );
    expect(messageDraft.update).toHaveBeenCalledWith({ where: { id: 'draft-1' }, data: { status: 'SENT' } });
  });

  it('uses the edited body/subject when the approval carries an editedPayload', async () => {
    const { prisma, approval, messageDraft, suppression, inboundMessage, idempotencyRecord, touchpoint } = createMockPrisma();
    approval.findUnique.mockResolvedValue({
      ...APPROVED_APPROVAL,
      status: 'EDITED',
      editedPayload: { body: 'Edited body', subject: 'Edited subject' },
    });
    messageDraft.findUniqueOrThrow.mockResolvedValue(DRAFT);
    suppression.findFirst.mockResolvedValue(null);
    inboundMessage.findFirst.mockResolvedValue(null);
    idempotencyRecord.findUnique.mockResolvedValue(null);
    idempotencyRecord.create.mockResolvedValue({});
    idempotencyRecord.update.mockResolvedValue({});
    touchpoint.create.mockResolvedValue({ id: 'touchpoint-1' });
    const { sender, send } = createMockSender();

    await processSendApproved(prisma, sender, { approvalId: 'approval-1', channel: 'EMAIL', toAddress: 'jane@acme.com' });

    expect(send).toHaveBeenCalledWith({ to: 'jane@acme.com', subject: 'Edited subject', body: 'Edited body' });
  });

  it('does not call the provider twice on a retry (idempotent send)', async () => {
    const { prisma, approval, messageDraft, suppression, inboundMessage, idempotencyRecord } = createMockPrisma();
    approval.findUnique.mockResolvedValue(APPROVED_APPROVAL);
    messageDraft.findUniqueOrThrow.mockResolvedValue(DRAFT);
    suppression.findFirst.mockResolvedValue(null);
    inboundMessage.findFirst.mockResolvedValue(null);

    const { computeRequestHash } = await import('./idempotency-service');
    const requestHash = computeRequestHash({ to: 'jane@acme.com', subject: 'Original subject', body: 'Original body' });
    idempotencyRecord.findUnique.mockResolvedValue({ requestHash, status: 'COMPLETED', responseJson: { providerMessageId: 'provider-msg-1' } });
    const { sender, send } = createMockSender();

    const result = await processSendApproved(prisma, sender, { approvalId: 'approval-1', channel: 'EMAIL', toAddress: 'jane@acme.com' });

    expect(result).toEqual({ kind: 'ALREADY_SENT', providerMessageId: 'provider-msg-1' });
    expect(send).not.toHaveBeenCalled();
  });
});
