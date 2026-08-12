export interface LearningAnalystPromptInput {
  windowStart: string;
  windowEnd: string;
  sampleSize: number;
  approvalOutcomeCounts: Readonly<Record<string, number>>;
  conversionCounts: Readonly<Record<string, number>>;
  agentFailureCounts: Readonly<Record<string, number>>;
  evalFailureSummaries: readonly string[];
}

/**
 * Every input here is our own aggregated, backend-computed telemetry — not
 * prospect- or web-controlled content — so there is no untrusted-content
 * section, same as the crm-sync prompt. The sampleSize is surfaced so the
 * model can factor it in, but whether a proposal is even persisted is
 * re-decided deterministically downstream via
 * @sinal/domain's hasSufficientSampleForProposal, never trusted from here.
 */
export function buildLearningAnalystPrompt(input: LearningAnalystPromptInput): string {
  const formatCounts = (counts: Readonly<Record<string, number>>): string[] => {
    const entries = Object.entries(counts);
    return entries.length === 0 ? ['(none)'] : entries.map(([key, value]) => `- ${key}: ${value}`);
  };

  return [
    'TRUSTED INTERNAL CONTEXT:',
    `window: ${input.windowStart} to ${input.windowEnd}`,
    `sample_size: ${input.sampleSize}`,
    '',
    'Approval decision outcomes:',
    ...formatCounts(input.approvalOutcomeCounts),
    '',
    'Conversions:',
    ...formatCounts(input.conversionCounts),
    '',
    'Agent failure counts:',
    ...formatCounts(input.agentFailureCounts),
    '',
    'Eval failure summaries:',
    ...(input.evalFailureSummaries.length > 0 ? input.evalFailureSummaries.map((s) => `- ${s}`) : ['(none)']),
  ].join('\n');
}
