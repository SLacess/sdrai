import { describe, expect, it } from 'vitest';
import { buildLearningAnalystPrompt } from './prompt';

describe('buildLearningAnalystPrompt', () => {
  it('surfaces the window, sample size, and aggregated counts', () => {
    const prompt = buildLearningAnalystPrompt({
      windowStart: '2026-08-04',
      windowEnd: '2026-08-11',
      sampleSize: 42,
      approvalOutcomeCounts: { APPROVED: 30, REJECTED: 5 },
      conversionCounts: { SQL: 8 },
      agentFailureCounts: { research_agent: 2 },
      evalFailureSummaries: ['policy_engine: 1 case regressed'],
    });

    expect(prompt).toContain('window: 2026-08-04 to 2026-08-11');
    expect(prompt).toContain('sample_size: 42');
    expect(prompt).toContain('- APPROVED: 30');
    expect(prompt).toContain('- SQL: 8');
    expect(prompt).toContain('- research_agent: 2');
    expect(prompt).toContain('- policy_engine: 1 case regressed');
  });

  it('shows "(none)" for empty counts and summaries', () => {
    const prompt = buildLearningAnalystPrompt({
      windowStart: '2026-08-04',
      windowEnd: '2026-08-11',
      sampleSize: 0,
      approvalOutcomeCounts: {},
      conversionCounts: {},
      agentFailureCounts: {},
      evalFailureSummaries: [],
    });

    expect(prompt).toContain('(none)');
  });
});
