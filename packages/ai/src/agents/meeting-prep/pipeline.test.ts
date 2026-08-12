import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import { AIGatewayError, type ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { runMeetingPrep } from './pipeline';

const EVIDENCE_ID = '11111111-1111-4111-8111-111111111111';

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 150, tokensOutput: 60 };
}

function envelope(overrides: Record<string, unknown>) {
  return {
    runId: '22222222-2222-4222-8222-222222222222',
    agent: 'meeting_prep_agent',
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.85,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

function goodBrief(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: 'Acme is evaluating accessibility remediation.',
    participants: [{ name: 'Jane Doe', role: 'CTO' }],
    history: ['Positive reply on 2026-08-03'],
    verifiedFacts: [{ claim: 'Checkout flow has keyboard issues', evidenceId: EVIDENCE_ID }],
    hypotheses: ['May be evaluating multiple vendors'],
    objectives: ['Confirm budget owner'],
    questions: ['What is the target launch date?'],
    likelyObjections: ['Price'],
    recommendedOffer: null,
    risks: [],
    doNotSay: ['Guaranteed legal compliance'],
    ...overrides,
  };
}

describe('runMeetingPrep', () => {
  it('invokes the gateway with the meeting_prep_agent schema and versioned system prompt', async () => {
    let capturedSystemPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      return response(envelope({ brief: goodBrief() }));
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runMeetingPrep({
      gateway,
      accountName: 'Acme',
      opportunityNeed: 'Accessibility remediation',
      participants: [{ name: 'Jane Doe', title: 'CTO' }],
      touchpointHistory: [],
      evidence: [{ id: EVIDENCE_ID, claim: 'Checkout flow has keyboard issues' }],
    });

    expect(result.output.brief.verifiedFacts[0]?.evidenceId).toBe(EVIDENCE_ID);
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('meeting_prep_agent'));
  });

  it('rejects (never accepts) a verified fact with no evidenceId', async () => {
    const provider = new StubProvider(() =>
      response(
        envelope({
          brief: goodBrief({ verifiedFacts: [{ claim: 'Fully WCAG compliant' }] }),
        }),
      ),
    );
    const gateway = new AIGateway({ primary: provider, maxRetries: 0 });

    await expect(
      runMeetingPrep({
        gateway,
        accountName: 'Acme',
        opportunityNeed: null,
        participants: [],
        touchpointHistory: [],
        evidence: [],
      }),
    ).rejects.toBeInstanceOf(AIGatewayError);
  });
});
