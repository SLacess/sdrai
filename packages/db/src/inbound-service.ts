import type { ChannelType, InboundMessage, IntentType, PrismaClient, SentimentType } from '@prisma/client';
import { suppressContact } from './suppression-service';

export interface HandleInboundMessageParams {
  contactId: string;
  channel: ChannelType;
  providerId?: string;
  rawContent: string;
  receivedAt: Date;
}

export interface HandleInboundMessageResult {
  inboundMessage: InboundMessage;
  pausedEnrollmentId: string | null;
}

/**
 * Pauses the contact's ACTIVE enrollment and persists the InboundMessage in
 * one transaction, with the pause happening first — this is the entire
 * mechanism behind the inbound/scheduler race guarantee
 * (docs/IMPLEMENTATION_GUIDE.md section 9): once this commits, the
 * scheduler's own CAS-guarded send can no longer see the enrollment as
 * ACTIVE, so it cannot fire a follow-up while the reply is being classified.
 */
export async function handleInboundMessage(
  prisma: PrismaClient,
  params: HandleInboundMessageParams,
): Promise<HandleInboundMessageResult> {
  return prisma.$transaction(async (tx) => {
    const activeEnrollment = await tx.sequenceEnrollment.findFirst({
      where: { contactId: params.contactId, state: 'ACTIVE' },
    });

    let pausedEnrollmentId: string | null = null;
    if (activeEnrollment) {
      const updated = await tx.sequenceEnrollment.updateMany({
        where: { id: activeEnrollment.id, version: activeEnrollment.version },
        data: {
          state: 'PAUSED',
          pausedAt: new Date(),
          pauseReason: 'Inbound reply received',
          version: { increment: 1 },
        },
      });
      if (updated.count > 0) {
        pausedEnrollmentId = activeEnrollment.id;
        await tx.leadStateEvent.create({
          data: {
            entityType: 'CONTACT',
            entityId: params.contactId,
            fromState: 'ACTIVE',
            toState: 'PAUSED',
            reason: 'Inbound reply received',
            actorType: 'SYSTEM',
            contactId: params.contactId,
          },
        });
      }
    }

    const inboundMessage = await tx.inboundMessage.create({
      data: {
        contactId: params.contactId,
        channel: params.channel,
        ...(params.providerId !== undefined ? { providerId: params.providerId } : {}),
        rawContent: params.rawContent,
        receivedAt: params.receivedAt,
      },
    });

    return { inboundMessage, pausedEnrollmentId };
  });
}

export interface ApplyReplyClassificationParams {
  inboundMessageId: string;
  contactId: string;
  intent: IntentType;
  sentiment: SentimentType;
  objection?: string;
  confidence: number;
  requiresHuman: boolean;
}

export interface ApplyReplyClassificationResult {
  inboundMessage: InboundMessage;
  suppressed: boolean;
}

/**
 * OPT_OUT is never just a label: classifying a reply as OPT_OUT immediately
 * suppresses the contact (CLAUDE.md rule 11), in the same call that
 * persists the classification.
 */
export async function applyReplyClassification(
  prisma: PrismaClient,
  params: ApplyReplyClassificationParams,
): Promise<ApplyReplyClassificationResult> {
  const inboundMessage = await prisma.inboundMessage.update({
    where: { id: params.inboundMessageId },
    data: {
      intent: params.intent,
      sentiment: params.sentiment,
      classificationConfidence: params.confidence,
      requiresHuman: params.requiresHuman,
      ...(params.objection !== undefined ? { objection: params.objection } : {}),
    },
  });

  if (params.intent !== 'OPT_OUT') {
    return { inboundMessage, suppressed: false };
  }

  await suppressContact(prisma, {
    scope: 'CONTACT',
    contactId: params.contactId,
    reason: 'Opt-out requested via inbound reply',
    source: 'reply_classifier',
  });

  return { inboundMessage, suppressed: true };
}
