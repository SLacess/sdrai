import { describe, expect, it } from 'vitest';
import { MockCalendarAdapter } from './mock-adapter';

const CAL = 'calendar-1';

describe('MockCalendarAdapter', () => {
  it('reports no busy slots for an empty calendar', async () => {
    const adapter = new MockCalendarAdapter();
    const slots = await adapter.getBusySlots({ calendarId: CAL, from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') });
    expect(slots).toEqual([]);
  });

  it('reflects a created event as a busy slot for an overlapping query window', async () => {
    const adapter = new MockCalendarAdapter();
    await adapter.createEvent({
      calendarId: CAL,
      title: 'Discovery call',
      start: new Date('2026-08-12T14:00:00Z'),
      end: new Date('2026-08-12T14:30:00Z'),
      timezone: 'UTC',
      participantEmails: ['jane@acme.com'],
    });

    const slots = await adapter.getBusySlots({ calendarId: CAL, from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') });
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({ start: new Date('2026-08-12T14:00:00Z'), end: new Date('2026-08-12T14:30:00Z') });
  });

  it('does not report an event outside the query window', async () => {
    const adapter = new MockCalendarAdapter();
    await adapter.createEvent({
      calendarId: CAL,
      title: 'Unrelated meeting',
      start: new Date('2026-08-20T14:00:00Z'),
      end: new Date('2026-08-20T14:30:00Z'),
      timezone: 'UTC',
      participantEmails: [],
    });

    const slots = await adapter.getBusySlots({ calendarId: CAL, from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') });
    expect(slots).toEqual([]);
  });

  it('seedBusySlot lets a test simulate an existing conflict without going through createEvent', async () => {
    const adapter = new MockCalendarAdapter();
    adapter.seedBusySlot(CAL, { start: new Date('2026-08-12T14:00:00Z'), end: new Date('2026-08-12T14:30:00Z') });

    const slots = await adapter.getBusySlots({ calendarId: CAL, from: new Date('2026-08-12T13:00:00Z'), to: new Date('2026-08-12T15:00:00Z') });
    expect(slots).toHaveLength(1);
  });

  it('keeps different calendars independent', async () => {
    const adapter = new MockCalendarAdapter();
    adapter.seedBusySlot('cal-a', { start: new Date('2026-08-12T14:00:00Z'), end: new Date('2026-08-12T14:30:00Z') });

    const slotsA = await adapter.getBusySlots({ calendarId: 'cal-a', from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') });
    const slotsB = await adapter.getBusySlots({ calendarId: 'cal-b', from: new Date('2026-08-12T00:00:00Z'), to: new Date('2026-08-13T00:00:00Z') });

    expect(slotsA).toHaveLength(1);
    expect(slotsB).toHaveLength(0);
  });

  it('createEvent returns a unique externalEventId per booking', async () => {
    const adapter = new MockCalendarAdapter();
    const a = await adapter.createEvent({ calendarId: CAL, title: 'A', start: new Date(), end: new Date(), timezone: 'UTC', participantEmails: [] });
    const b = await adapter.createEvent({ calendarId: CAL, title: 'B', start: new Date(), end: new Date(), timezone: 'UTC', participantEmails: [] });
    expect(a.externalEventId).not.toBe(b.externalEventId);
  });
});
