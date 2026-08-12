import { UNTRUSTED_CONTENT_WARNING, wrapUntrustedContent } from '../shared/prompt-parts';

export interface QualificationPromptInput {
  contactName: string;
  accountName: string;
  accountScore: number | null;
  conversationHistory: string;
}

/**
 * The conversation history is the prospect's own words, so it's wrapped
 * exactly like a reply classification prompt — untrusted data, never
 * instructions — even though the qualification decision itself is made
 * deterministically by @sinal/domain's determineIsSql, not trusted from
 * whatever the agent claims.
 */
export function buildQualificationPrompt(input: QualificationPromptInput): string {
  return [
    'TRUSTED INTERNAL CONTEXT:',
    `contact_name: ${input.contactName}`,
    `account_name: ${input.accountName}`,
    `account_score: ${input.accountScore ?? 'unknown'}`,
    '',
    UNTRUSTED_CONTENT_WARNING,
    '',
    wrapUntrustedContent(input.conversationHistory, { source: 'conversation_history' }),
  ].join('\n');
}
