/**
 * WF-16: "insufficient sample => no proposal / observation only". This is
 * recomputed here rather than trusted from the Learning Analyst agent's own
 * output, so a model that overstates its confidence in a thin dataset can
 * never get a change proposal persisted (same containment pattern as
 * confidence gating and evidence checks elsewhere in @sinal/domain).
 */
export const MIN_LEARNING_SAMPLE_SIZE = 20;

export function hasSufficientSampleForProposal(sampleSize: number): boolean {
  return sampleSize >= MIN_LEARNING_SAMPLE_SIZE;
}
