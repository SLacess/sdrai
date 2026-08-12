import { describe, expect, it } from 'vitest';
import { buildMeetingPrepPrompt } from './prompt';

describe('buildMeetingPrepPrompt', () => {
  it('lists participants, touchpoint history, and available evidence', () => {
    const prompt = buildMeetingPrepPrompt({
      accountName: 'Acme',
      opportunityNeed: 'Accessibility remediation before Q4 audit',
      participants: [{ name: 'Jane Doe', title: 'CTO' }],
      touchpointHistory: ['2026-08-01: first touch sent', '2026-08-03: positive reply'],
      evidence: [{ id: '11111111-1111-4111-8111-111111111111', claim: 'Checkout flow has keyboard issues' }],
    });

    expect(prompt).toContain('opportunity_need: Accessibility remediation before Q4 audit');
    expect(prompt).toContain('- Jane Doe (CTO)');
    expect(prompt).toContain('- 2026-08-01: first touch sent');
    expect(prompt).toContain('evidenceId=11111111-1111-4111-8111-111111111111');
  });

  it('shows "unknown" when the opportunity need is not yet established', () => {
    const prompt = buildMeetingPrepPrompt({
      accountName: 'Acme',
      opportunityNeed: null,
      participants: [],
      touchpointHistory: [],
      evidence: [],
    });
    expect(prompt).toContain('opportunity_need: unknown');
  });
});
