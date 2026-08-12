export interface FreeBusySlot {
  start: Date;
  end: Date;
}

export interface GetBusySlotsParams {
  calendarId: string;
  from: Date;
  to: Date;
}

export interface CreateCalendarEventParams {
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  timezone: string;
  participantEmails: string[];
}

export interface CreateCalendarEventResult {
  externalEventId: string;
}

export interface CalendarAdapter {
  readonly name: string;
  getBusySlots(params: GetBusySlotsParams): Promise<FreeBusySlot[]>;
  createEvent(params: CreateCalendarEventParams): Promise<CreateCalendarEventResult>;
}
