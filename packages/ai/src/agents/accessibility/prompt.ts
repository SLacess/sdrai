import type { AllocatedSource } from '../shared/evidence-allocation';
import { buildTrustedEvidenceSourceList, buildUntrustedContentBlocks, UNTRUSTED_CONTENT_WARNING } from '../shared/prompt-parts';

export interface AccessibilityPromptInput {
  accountName: string;
  accountDomain: string;
  /** One allocated source per scan finding — rawContent is the finding's own description/selector, serialized. */
  findings: readonly AllocatedSource[];
}

/**
 * Same TRUSTED/UNTRUSTED separation as the research prompt. Scan findings
 * are automated data, not instructions — the schema additionally forces
 * `scanIsIndicator: true` on every signal, so even a compromised or
 * over-eager model output cannot claim compliance/legal status.
 */
export function buildAccessibilityUserPrompt(input: AccessibilityPromptInput): string {
  const trusted = [
    'TRUSTED INTERNAL CONTEXT:',
    `account_name: ${input.accountName}`,
    `account_domain: ${input.accountDomain}`,
    '',
    'Available evidence sources (one per automated scan finding). Cite ONLY these evidenceId values; do not invent new ones:',
    buildTrustedEvidenceSourceList(input.findings),
  ].join('\n');

  return [trusted, '', UNTRUSTED_CONTENT_WARNING, '', buildUntrustedContentBlocks(input.findings)].join('\n');
}
