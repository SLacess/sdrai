import type { Approval, Meeting, Prisma, PrismaClient } from '@prisma/client';
import { evaluateAction, type PolicyDecisionResult } from '@sinal/policies';
import { isValidTimezone } from '@sinal/domain';
import { createApproval } from './approval-service';
import { transitionEntityState } from './state-transition';

export interface CalendarAdapter {
  getBusySlots(params: { calendarId: string; from: Date; to: Date }): Promise<Array<{ start: Date; end: Date }>>;
  createEvent(params: {
    calendarId: string;
    title: string;
    start: Date;
    end: Date;
    timezone: string;
    participantEmails: string[];
  }): Promise<{ externalEventId: string }>;
}

interface MeetingApprovalPayload {
  contactId: string;
  proposedStart: string;
  proposedEnd: string;
  timezone: string;
  meetingTitle: string;
  participantEmails: string[];
}

export interface RequestMeetingBookingParams {
  opportunityId: string;
  contactId: string;
  proposedStart: Date;
  proposedEnd: Date;
  timezone: string;
  meetingTitle: string;
  participantEmails: string[];
  confidence: number;
}

export interface RequestMeetingBookingResult {
  policyDecision: PolicyDecisionResult;
  approval: Approval | null;
}

export class InvalidTimezoneError extends Error {
  constructor(public timezone: string) {
    super(`"${timezone}" is not a valid IANA timezone`);
  }
}

/**
 * Meeting booking is always at least YELLOW ("Yellow initially" — WF-11).
 * More than one participant forces isDemoOrNegotiation=true, which the
 * Policy Engine treats as RED — a stricter, human-always tier than the
 * ordinary single-contact YELLOW path, so a multi-participant booking can
 * never be auto-approved even after future autonomy promotion.
 */
export async function requestMeetingBooking(
  prisma: PrismaClient,
  params: RequestMeetingBookingParams,
): Promise<RequestMeetingBookingResult> {
  if (!isValidTimezone(params.timezone)) throw new InvalidTimezoneError(params.timezone);

  const isMultiParticipant = params.participantEmails.length > 1;

  const policyDecision = evaluateAction({
    action: 'book_meeting',
    actionClass: 'YELLOW',
    confidence: params.confidence,
    accountVip: false,
    hasSuppression: false,
    frequencyCapOk: true,
    requiredEvidencePresent: true,
    verifiedChannel: true,
    inboundPending: false,
    containsTechnicalOrLegalClaim: false,
    approvedKnowledgeForClaim: false,
    isFirstTouch: false,
    isCustomPricing: false,
    isContractLegalSecurity: false,
    isDemoOrNegotiation: isMultiParticipant,
  });

  let approval: Approval | null = null;
  if (policyDecision.outcome === 'REQUIRE_APPROVAL') {
    const payload: MeetingApprovalPayload = {
      contactId: params.contactId,
      proposedStart: params.proposedStart.toISOString(),
      proposedEnd: params.proposedEnd.toISOString(),
      timezone: params.timezone,
      meetingTitle: params.meetingTitle,
      participantEmails: params.participantEmails,
    };
    approval = await createApproval(prisma, {
      actionType: 'BOOK_MEETING',
      entityType: 'OPPORTUNITY',
      entityId: params.opportunityId,
      payload: payload as unknown as Prisma.InputJsonValue,
      riskLevel: policyDecision.riskLevel,
      rationale: policyDecision.reason,
      confidence: params.confidence,
    });
  }

  return { policyDecision, approval };
}

export type ConfirmMeetingBookingOutcome =
  | { kind: 'BOOKED'; meetingId: string; externalEventId: string }
  | { kind: 'SLOT_NO_LONGER_AVAILABLE' }
  | { kind: 'INVALID_APPROVAL_STATE'; status: string }
  | { kind: 'NOT_FOUND' };

/**
 * Re-queries free/busy for the exact proposed window immediately before
 * createEvent — the state at approval time is not trusted, only the state
 * right now (WF-11: "calendar race => recheck before create").
 */
export async function confirmMeetingBooking(
  prisma: PrismaClient,
  calendar: CalendarAdapter,
  params: { approvalId: string; calendarId: string },
): Promise<ConfirmMeetingBookingOutcome> {
  const approval = await prisma.approval.findUnique({ where: { id: params.approvalId } });
  if (!approval) return { kind: 'NOT_FOUND' };
  if (approval.status !== 'APPROVED' && approval.status !== 'EDITED') {
    return { kind: 'INVALID_APPROVAL_STATE', status: approval.status };
  }

  const payload = approval.payload as unknown as MeetingApprovalPayload;
  const start = new Date(payload.proposedStart);
  const end = new Date(payload.proposedEnd);

  const busySlots = await calendar.getBusySlots({ calendarId: params.calendarId, from: start, to: end });
  const overlaps = busySlots.some((slot) => slot.start < end && slot.end > start);
  if (overlaps) return { kind: 'SLOT_NO_LONGER_AVAILABLE' };

  const event = await calendar.createEvent({
    calendarId: params.calendarId,
    title: payload.meetingTitle,
    start,
    end,
    timezone: payload.timezone,
    participantEmails: payload.participantEmails,
  });

  const meeting: Meeting = await prisma.meeting.create({
    data: {
      opportunityId: approval.entityId,
      externalId: event.externalEventId,
      participants: payload.participantEmails,
      scheduledAt: start,
      timezone: payload.timezone,
      status: 'SCHEDULED',
    },
  });

  const contact = await prisma.contact.findUnique({ where: { id: payload.contactId } });
  if (contact && contact.leadState !== 'MEETING_BOOKED') {
    await transitionEntityState(prisma, {
      entity: 'CONTACT',
      id: payload.contactId,
      from: contact.leadState,
      to: 'MEETING_BOOKED',
      reason: 'Meeting confirmed',
      actorType: 'SYSTEM',
    });
  }

  return { kind: 'BOOKED', meetingId: meeting.id, externalEventId: event.externalEventId };
}
