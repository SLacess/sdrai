import type { AllocatedSource } from '../shared/evidence-allocation';
import { buildTrustedEvidenceSourceList, buildUntrustedContentBlocks, UNTRUSTED_CONTENT_WARNING } from '../shared/prompt-parts';

export interface ResearchPromptInput {
  accountName: string;
  accountDomain: string;
  sources: readonly AllocatedSource[];
}

/**
 * Builds the user message with a hard textual separation between content we
 * generated ourselves (TRUSTED) and content scraped from the web (UNTRUSTED).
 * The trusted "available sources" list is built purely from our own
 * allocated evidence ids, so nothing inside the untrusted blocks can ever
 * make its way into that list — it's a structural guarantee, not a request
 * to the model.
 */
export function buildResearchUserPrompt(input: ResearchPromptInput): string {
  const trusted = [
    'TRUSTED INTERNAL CONTEXT:',
    `account_name: ${input.accountName}`,
    `account_domain: ${input.accountDomain}`,
    '',
    'Available evidence sources. Cite ONLY these evidenceId values in facts[]; do not invent new ones:',
    buildTrustedEvidenceSourceList(input.sources),
  ].join('\n');

  return [trusted, '', UNTRUSTED_CONTENT_WARNING, '', buildUntrustedContentBlocks(input.sources)].join('\n');
}
