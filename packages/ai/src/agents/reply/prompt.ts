import { UNTRUSTED_CONTENT_WARNING, wrapUntrustedContent } from '../shared/prompt-parts';

export interface ReplyClassifierPromptInput {
  contactName: string;
  channel: string;
  rawContent: string;
}

/**
 * The inbound reply is the one piece of content in this prompt that a
 * prospect fully controls, so it's wrapped exactly like research/scan
 * content — untrusted data, never instructions — even though it's shorter
 * and doesn't need the multi-source evidence-id allocation those agents use.
 */
export function buildReplyClassifierPrompt(input: ReplyClassifierPromptInput): string {
  return [
    'TRUSTED INTERNAL CONTEXT:',
    `contact_name: ${input.contactName}`,
    `channel: ${input.channel}`,
    '',
    UNTRUSTED_CONTENT_WARNING,
    '',
    wrapUntrustedContent(input.rawContent, { source: 'inbound_reply' }),
  ].join('\n');
}
