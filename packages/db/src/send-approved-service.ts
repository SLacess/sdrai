import type { ChannelType, PrismaClient } from '@prisma/client';
import { isSuppressed } from './suppression-service';
import { sendEmailIdempotent, type EmailSender } from './send-service';

export interface ProcessSendApprovedParams {
  approvalId: string;
  channel: ChannelType;
  toAddress: string;
}

export type ProcessSendApprovedOutcome =
  | { kind: 'SENT'; touchpointId: string; providerMessageId: string }
  | { kind: 'ALREADY_SENT'; providerMessageId: string | null }
  | { kind: 'BLOCKED'; reason: string }
  | { kind: 'INVALID_APPROVAL_STATE'; status: string }
  | { kind: 'NOT_FOUND' };

/**
 * WF-07: re-runs suppression + inbound-reply checks immediately before the
 * provider call, using CURRENT state — not the state at approval time. A
 * suppression or a reply that arrived after the human approved this draft
 * blocks the send even though the Approval itself is still APPROVED
 * (docs/IMPLEMENTATION_GUIDE.md section 7/9: fresh state right before the
 * side effect, every time).
 */
export async function processSendApproved(
  prisma: PrismaClient,
  sender: EmailSender,
  params: ProcessSendApprovedParams,
): Promise<ProcessSendApprovedOutcome> {
  const approval = await prisma.approval.findUnique({ where: { id: params.approvalId } });
  if (!approval) return { kind: 'NOT_FOUND' };
  if (approval.status !== 'APPROVED' && approval.status !== 'EDITED') {
    return { kind: 'INVALID_APPROVAL_STATE', status: approval.status };
  }
  if (!approval.messageDraftId) return { kind: 'INVALID_APPROVAL_STATE', status: 'NO_MESSAGE_DRAFT' };

  const messageDraft = await prisma.messageDraft.findUniqueOrThrow({ where: { id: approval.messageDraftId } });

  const sinceInboundCheck = approval.decisionAt ?? approval.createdAt;
  const suppressed = await isSuppressed(prisma, { contactId: messageDraft.contactId });
  const newerInbound = suppressed
    ? null
    : await prisma.inboundMessage.findFirst({
        where: { contactId: messageDraft.contactId, receivedAt: { gt: sinceInboundCheck } },
      });

  if (suppressed || newerInbound) {
    const reason = suppressed ? 'Contact is suppressed' : 'New inbound reply received since approval';
    await prisma.messageDraft.update({ where: { id: messageDraft.id }, data: { status: 'CANCELLED' } });
    return { kind: 'BLOCKED', reason };
  }

  const editedPayload = approval.editedPayload as { body?: string; subject?: string } | null;
  const body = editedPayload?.body ?? messageDraft.body;
  const subject = editedPayload?.subject ?? messageDraft.subject ?? '';
  const idempotencyKey = `send-touchpoint:${messageDraft.id}`;

  const sendOutcome = await sendEmailIdempotent(prisma, sender, {
    idempotencyKey,
    to: params.toAddress,
    subject,
    body,
  });

  if (sendOutcome.kind === 'CONFLICT') {
    return { kind: 'BLOCKED', reason: 'Idempotency key conflict' };
  }
  if (sendOutcome.kind === 'DUPLICATE') {
    return { kind: 'ALREADY_SENT', providerMessageId: sendOutcome.providerMessageId };
  }

  const touchpoint = await prisma.touchpoint.create({
    data: {
      contactId: messageDraft.contactId,
      channel: params.channel,
      direction: 'OUTBOUND',
      type: 'FIRST_TOUCH',
      subject,
      content: body,
      sentAt: new Date(),
      providerId: sendOutcome.providerMessageId,
      status: 'SENT',
      idempotencyKey,
    },
  });

  await prisma.messageDraft.update({ where: { id: messageDraft.id }, data: { status: 'SENT' } });

  return { kind: 'SENT', touchpointId: touchpoint.id, providerMessageId: sendOutcome.providerMessageId };
}
