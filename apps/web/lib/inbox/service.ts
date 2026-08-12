import type { IntentType, PrismaClient, SentimentType } from '@sinal/db';

const INBOX_LIMIT = 50;

export interface InboxDraftDTO {
  id: string;
  status: string;
  riskLevel: string;
  approvalStatus: string | null;
}

export interface InboxThreadDTO {
  inboundMessageId: string;
  contactId: string;
  contactName: string;
  accountId: string;
  accountName: string;
  channel: string;
  rawContent: string;
  receivedAt: Date;
  intent: IntentType;
  sentiment: SentimentType;
  classificationConfidence: number | null;
  requiresHuman: boolean;
  proposedDraft: InboxDraftDTO | null;
}

export interface ListInboxThreadsParams {
  onlyRequiringHuman?: boolean;
}

/**
 * The Inbox UI must never expose a control that sends a reply directly —
 * only the Approval Center's human-decision flow can turn a draft into a
 * send. None of these variants carries a send callback/URL, so it is not
 * just a UI convention that the Inbox page can't trigger a send: the type
 * returned to it cannot express one.
 */
export type ProposedActionView =
  | { kind: 'NO_DRAFT_YET' }
  | { kind: 'PENDING_HUMAN_REVIEW'; riskLevel: string; draftStatus: string }
  | { kind: 'DECIDED'; riskLevel: string; draftStatus: string; approvalStatus: string };

export function describeProposedAction(draft: InboxDraftDTO | null): ProposedActionView {
  if (draft === null) return { kind: 'NO_DRAFT_YET' };
  if (draft.approvalStatus === null || draft.approvalStatus === 'PENDING') {
    return { kind: 'PENDING_HUMAN_REVIEW', riskLevel: draft.riskLevel, draftStatus: draft.status };
  }
  return {
    kind: 'DECIDED',
    riskLevel: draft.riskLevel,
    draftStatus: draft.status,
    approvalStatus: draft.approvalStatus,
  };
}

/**
 * MessageDraft has no direct FK to the InboundMessage it replies to, so a
 * draft is matched to a thread by "most recent draft for this contact
 * created at/after the inbound message arrived" — good enough for a single
 * reply-per-inbound cadence, which is how the reply-composer agent operates.
 */
export async function listInboxThreads(
  prisma: PrismaClient,
  params: ListInboxThreadsParams = {},
): Promise<InboxThreadDTO[]> {
  const messages = await prisma.inboundMessage.findMany({
    where: params.onlyRequiringHuman ? { requiresHuman: true } : {},
    orderBy: { receivedAt: 'desc' },
    take: INBOX_LIMIT,
    include: { contact: { include: { account: true } } },
  });

  if (messages.length === 0) return [];

  const contactIds = [...new Set(messages.map((message) => message.contactId))];
  const drafts = await prisma.messageDraft.findMany({
    where: { contactId: { in: contactIds } },
    orderBy: { createdAt: 'desc' },
    include: { approvals: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  return messages.map((message) => {
    const draft = drafts.find(
      (candidate) => candidate.contactId === message.contactId && candidate.createdAt >= message.receivedAt,
    );

    return {
      inboundMessageId: message.id,
      contactId: message.contactId,
      contactName: message.contact.name,
      accountId: message.contact.account.id,
      accountName: message.contact.account.brandName,
      channel: message.channel,
      rawContent: message.rawContent,
      receivedAt: message.receivedAt,
      intent: message.intent,
      sentiment: message.sentiment,
      classificationConfidence: message.classificationConfidence,
      requiresHuman: message.requiresHuman,
      proposedDraft: draft
        ? {
            id: draft.id,
            status: draft.status,
            riskLevel: draft.riskLevel,
            approvalStatus: draft.approvals[0]?.status ?? null,
          }
        : null,
    };
  });
}
