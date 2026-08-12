import { randomUUID } from 'node:crypto';
import type { CalendarAdapter, CreateCalendarEventParams, CreateCalendarEventResult, FreeBusySlot, GetBusySlotsParams } from './types';

interface StoredEvent extends FreeBusySlot {
  externalEventId: string;
}

/**
 * No real Google/Outlook credential available (CALENDAR_CREDENTIAL_REF in
 * .env.example is blank). Keeps a real in-memory event list per calendar so
 * getBusySlots reflects whatever createEvent has actually booked — this is
 * what makes BP-031's "recheck immediately before create" testable end to
 * end rather than against an adapter that always reports empty.
 */
export class MockCalendarAdapter implements CalendarAdapter {
  readonly name = 'mock';
  private readonly eventsByCalendar = new Map<string, StoredEvent[]>();

  async getBusySlots(params: GetBusySlotsParams): Promise<FreeBusySlot[]> {
    const events = this.eventsByCalendar.get(params.calendarId) ?? [];
    return events
      .filter((event) => event.start < params.to && event.end > params.from)
      .map((event) => ({ start: event.start, end: event.end }));
  }

  async createEvent(params: CreateCalendarEventParams): Promise<CreateCalendarEventResult> {
    const externalEventId = randomUUID();
    const events = this.eventsByCalendar.get(params.calendarId) ?? [];
    events.push({ externalEventId, start: params.start, end: params.end });
    this.eventsByCalendar.set(params.calendarId, events);
    return { externalEventId };
  }

  /** Test/dev helper to simulate a slot that's already booked (e.g. by another tool). */
  seedBusySlot(calendarId: string, slot: FreeBusySlot): void {
    const events = this.eventsByCalendar.get(calendarId) ?? [];
    events.push({ externalEventId: randomUUID(), ...slot });
    this.eventsByCalendar.set(calendarId, events);
  }
}
