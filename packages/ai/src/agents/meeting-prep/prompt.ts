import { buildTrustedEvidenceSummaryList, type EvidenceSummary } from '../shared/prompt-parts';

export interface MeetingPrepPromptInput {
  accountName: string;
  opportunityNeed: string | null;
  participants: readonly { name: string; title?: string }[];
  touchpointHistory: readonly string[];
  evidence: readonly EvidenceSummary[];
}

/**
 * Everything here is our own retrieved/stored data (account record,
 * touchpoint log, vetted evidence) — no raw third-party content is passed
 * directly, so there's no untrusted-content section. verifiedFacts in the
 * output schema require an evidenceId (Zod), and only ids listed here are
 * legitimate to cite.
 */
export function buildMeetingPrepPrompt(input: MeetingPrepPromptInput): string {
  return [
    'TRUSTED INTERNAL CONTEXT:',
    `account_name: ${input.accountName}`,
    `opportunity_need: ${input.opportunityNeed ?? 'unknown'}`,
    '',
    'Participants:',
    ...input.participants.map((p) => `- ${p.name}${p.title ? ` (${p.title})` : ''}`),
    '',
    'Touchpoint history:',
    ...input.touchpointHistory.map((entry) => `- ${entry}`),
    '',
    'Available evidence. Cite ONLY these evidenceId values in verifiedFacts; do not invent new ones:',
    buildTrustedEvidenceSummaryList(input.evidence),
  ].join('\n');
}
