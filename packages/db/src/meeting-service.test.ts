import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { confirmMeetingBooking, InvalidTimezoneError, requestMeetingBooking, type CalendarAdapter } from './meeting-service';

function createMockPrisma() {
  const approval = { create: vi.fn(), findUnique: vi.fn() };
  const meeting = { create: vi.fn() };
  const contact = { findUnique: vi.fn(), updateMany: vi.fn() };
  const leadStateEvent = { create: vi.fn() };
  const tx = { contact, leadStateEvent };
  const prisma = {
    approval,
    meeting,
    contact,
    $transaction: vi.fn(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, approval, meeting, contact, leadStateEvent };
}

function createMockCalendar() {
  const getBusySlots = vi.fn().mockResolvedValue([]);
  const createEvent = vi.fn().mockResolvedValue({ externalEventId: 'ext-event-1' });
  return { calendar: { getBusySlots, createEvent } as CalendarAdapter, getBusySlots, createEvent };
}

const BASE_REQUEST = {
  opportunityId: 'opp-1',
  contactId: 'contact-1',
  proposedStart: new Date('2026-08-12T14:00:00.000Z'),
  proposedEnd: new Date('2026-08-12T14:30:00.000Z'),
  timezone: 'America/Sao_Paulo',
  meetingTitle: 'Discovery call',
  participantEmails: ['jane@acme.com'],
  confidence: 0.9,
};

describe('requestMeetingBooking', () => {
  it('rejects an invalid timezone before touching the database', async () => {
    const { prisma, approval } = createMockPrisma();
    await expect(
      requestMeetingBooking(prisma, { ...BASE_REQUEST, timezone: 'Not/A_Zone' }),
    ).rejects.toBeInstanceOf(InvalidTimezoneError);
    expect(approval.create).not.toHaveBeenCalled();
  });

  it('creates a YELLOW approval for a single-participant meeting', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.create.mockResolvedValue({ id: 'approval-1' });

    const result = await requestMeetingBooking(prisma, BASE_REQUEST);

    expect(result.policyDecision.outcome).toBe('REQUIRE_APPROVAL');
    expect(result.policyDecision.riskLevel).toBe('YELLOW');
    expect(approval.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ riskLevel: 'YELLOW', entityType: 'OPPORTUNITY', entityId: 'opp-1' }) }),
    );
  });

  it('forces RED risk (never auto-approvable) for a multi-participant meeting', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.create.mockResolvedValue({ id: 'approval-1' });

    const result = await requestMeetingBooking(prisma, {
      ...BASE_REQUEST,
      participantEmails: ['jane@acme.com', 'bob@acme.com'],
    });

    expect(result.policyDecision.riskLevel).toBe('RED');
    expect(result.approval).not.toBeNull();
  });

  it('serializes the proposed window and participants into the approval payload', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.create.mockResolvedValue({ id: 'approval-1' });

    await requestMeetingBooking(prisma, BASE_REQUEST);

    const call = approval.create.mock.calls[0]?.[0];
    expect(call.data.payload).toEqual({
      contactId: 'contact-1',
      proposedStart: '2026-08-12T14:00:00.000Z',
      proposedEnd: '2026-08-12T14:30:00.000Z',
      timezone: 'America/Sao_Paulo',
      meetingTitle: 'Discovery call',
      participantEmails: ['jane@acme.com'],
    });
  });
});

const APPROVED_PAYLOAD = {
  contactId: 'contact-1',
  proposedStart: '2026-08-12T14:00:00.000Z',
  proposedEnd: '2026-08-12T14:30:00.000Z',
  timezone: 'America/Sao_Paulo',
  meetingTitle: 'Discovery call',
  participantEmails: ['jane@acme.com'],
};

describe('confirmMeetingBooking', () => {
  it('returns NOT_FOUND for a missing approval', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValue(null);
    const { calendar } = createMockCalendar();

    const result = await confirmMeetingBooking(prisma, calendar, { approvalId: 'x', calendarId: 'cal-1' });
    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });

  it('returns INVALID_APPROVAL_STATE when the approval is not APPROVED/EDITED', async () => {
    const { prisma, approval } = createMockPrisma();
    approval.findUnique.mockResolvedValue({ id: 'approval-1', status: 'PENDING', payload: APPROVED_PAYLOAD, entityId: 'opp-1' });
    const { calendar, getBusySlots } = createMockCalendar();

    const result = await confirmMeetingBooking(prisma, calendar, { approvalId: 'approval-1', calendarId: 'cal-1' });
    expect(result).toEqual({ kind: 'INVALID_APPROVAL_STATE', status: 'PENDING' });
    expect(getBusySlots).not.toHaveBeenCalled();
  });

  it('blocks the booking when the slot is no longer available (race)', async () => {
    const { prisma, approval, meeting } = createMockPrisma();
    approval.findUnique.mockResolvedValue({ id: 'approval-1', status: 'APPROVED', payload: APPROVED_PAYLOAD, entityId: 'opp-1' });
    const { calendar, createEvent } = createMockCalendar();
    calendar.getBusySlots = vi.fn().mockResolvedValue([
      { start: new Date('2026-08-12T14:15:00.000Z'), end: new Date('2026-08-12T14:45:00.000Z') },
    ]);

    const result = await confirmMeetingBooking(prisma, calendar, { approvalId: 'approval-1', calendarId: 'cal-1' });

    expect(result).toEqual({ kind: 'SLOT_NO_LONGER_AVAILABLE' });
    expect(createEvent).not.toHaveBeenCalled();
    expect(meeting.create).not.toHaveBeenCalled();
  });

  it('books the meeting and transitions the contact to MEETING_BOOKED on the clear path', async () => {
    const { prisma, approval, meeting, contact } = createMockPrisma();
    approval.findUnique.mockResolvedValue({ id: 'approval-1', status: 'APPROVED', payload: APPROVED_PAYLOAD, entityId: 'opp-1' });
    meeting.create.mockResolvedValue({ id: 'meeting-1' });
    contact.findUnique.mockResolvedValue({ id: 'contact-1', leadState: 'SQL' });
    contact.updateMany.mockResolvedValue({ count: 1 });
    const { calendar, createEvent } = createMockCalendar();

    const result = await confirmMeetingBooking(prisma, calendar, { approvalId: 'approval-1', calendarId: 'cal-1' });

    expect(result).toEqual({ kind: 'BOOKED', meetingId: 'meeting-1', externalEventId: 'ext-event-1' });
    expect(createEvent).toHaveBeenCalledWith({
      calendarId: 'cal-1',
      title: 'Discovery call',
      start: new Date('2026-08-12T14:00:00.000Z'),
      end: new Date('2026-08-12T14:30:00.000Z'),
      timezone: 'America/Sao_Paulo',
      participantEmails: ['jane@acme.com'],
    });
    expect(contact.updateMany).toHaveBeenCalledWith({
      where: { id: 'contact-1', leadState: 'SQL' },
      data: { leadState: 'MEETING_BOOKED' },
    });
  });

  it('skips the contact transition when the contact is already MEETING_BOOKED', async () => {
    const { prisma, approval, meeting, contact } = createMockPrisma();
    approval.findUnique.mockResolvedValue({ id: 'approval-1', status: 'APPROVED', payload: APPROVED_PAYLOAD, entityId: 'opp-1' });
    meeting.create.mockResolvedValue({ id: 'meeting-1' });
    contact.findUnique.mockResolvedValue({ id: 'contact-1', leadState: 'MEETING_BOOKED' });
    const { calendar } = createMockCalendar();

    const result = await confirmMeetingBooking(prisma, calendar, { approvalId: 'approval-1', calendarId: 'cal-1' });

    expect(result.kind).toBe('BOOKED');
    expect(contact.updateMany).not.toHaveBeenCalled();
  });
});
