import { UNTRUSTED_CONTENT_WARNING, wrapUntrustedContent } from '../shared/prompt-parts';

export interface MeetingCoordinatorPromptInput {
  contactName: string;
  accountName: string;
  confirmedTimezone: string;
  availableSlots: string[];
  meetingRequestText: string;
}

/**
 * The prospect's own scheduling request (from an inbound reply) is wrapped
 * as untrusted, same as reply/qualification prompts. Available slots come
 * from our own free/busy lookup, so they're trusted.
 */
export function buildMeetingCoordinatorPrompt(input: MeetingCoordinatorPromptInput): string {
  return [
    'TRUSTED INTERNAL CONTEXT:',
    `contact_name: ${input.contactName}`,
    `account_name: ${input.accountName}`,
    `confirmed_timezone: ${input.confirmedTimezone}`,
    'Available slots (ISO 8601, already free/busy-checked):',
    ...input.availableSlots.map((slot) => `- ${slot}`),
    '',
    UNTRUSTED_CONTENT_WARNING,
    '',
    wrapUntrustedContent(input.meetingRequestText, { source: 'meeting_request' }),
  ].join('\n');
}
