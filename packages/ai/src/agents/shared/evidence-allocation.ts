import { randomUUID } from 'node:crypto';

export interface SourceRef {
  sourceUri: string;
  rawContent: string;
}

export interface AllocatedSource extends SourceRef {
  evidenceId: string;
}

/**
 * Pre-generates an evidence id for each source BEFORE the LLM ever sees the
 * content, so a fact/signal can only "bind evidence" that we ourselves
 * created — an id fabricated by the model (via hallucination or a
 * prompt-injection attempt embedded in the source content) has no matching
 * allocation and is dropped at persistence time (see persistResearchFacts /
 * persistAccessibilitySignals in @sinal/db).
 */
export function allocateEvidenceIds(sources: readonly SourceRef[]): AllocatedSource[] {
  return sources.map((source) => ({ ...source, evidenceId: randomUUID() }));
}
