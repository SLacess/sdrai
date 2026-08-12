import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import type { ProviderRawResponse } from '../../gateway/types';
import { runFirstTouchPipeline } from './orchestrator';

const EVIDENCE_ID = '11111111-1111-4111-8111-111111111111';
const KNOWLEDGE_ID = '22222222-2222-4222-8222-222222222222';

function envelope(agent: string, overrides: Record<string, unknown>) {
  return {
    runId: '33333333-3333-4333-8333-333333333333',
    agent,
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.9,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 100, tokensOutput: 40 };
}

function sequencedProvider(responses: ProviderRawResponse[]): StubProvider {
  let call = 0;
  return new StubProvider(() => {
    const next = responses[call];
    call += 1;
    if (!next) throw new Error('no more scripted responses');
    return next;
  });
}

describe('runFirstTouchPipeline', () => {
  it('chains angle -> writer -> supervisor and threads the angle into the writer prompt', async () => {
    const provider = sequencedProvider([
      response(
        envelope('message_angle_agent', {
          angle: { name: 'Accessibility risk', personaRelevance: 'CTO', problemFrame: 'Slow checkout for keyboard users', cta: 'Book a 15min call', evidenceIds: [EVIDENCE_ID] },
          alternatives: [],
        }),
      ),
      response(
        envelope('personalization_writer', {
          draft: {
            body: 'Hi Jane, noticed your checkout flow...',
            language: 'pt-BR',
            evidenceIds: [EVIDENCE_ID],
            knowledgeItemIds: [KNOWLEDGE_ID],
            claims: [{ text: 'Checkout flow has keyboard-navigation issues', support: [{ evidenceId: EVIDENCE_ID, claim: 'x' }] }],
          },
        }),
      ),
      response(
        envelope('ai_supervisor', {
          verdict: 'PASS',
          unsupportedClaims: [],
          staleEvidenceIds: [],
          genericityScore: 0.2,
          personalizationScore: 0.8,
          policyRisk: 'YELLOW',
          requiredApproval: true,
          reasons: [],
        }),
      ),
    ]);
    const gateway = new AIGateway({ primary: provider });

    const result = await runFirstTouchPipeline({
      gateway,
      contactName: 'Jane Doe',
      accountName: 'Acme',
      language: 'pt-BR',
      evidence: [{ id: EVIDENCE_ID, claim: 'Checkout flow has keyboard-navigation issues' }],
      knowledgeItems: [{ id: KNOWLEDGE_ID, claim: 'Accessibility Audit product description' }],
      validEvidence: [{ id: EVIDENCE_ID, claim: 'Checkout flow has keyboard-navigation issues' }],
    });

    expect(result.angle.output.angle.cta).toBe('Book a 15min call');
    expect(result.draft.output.draft.body).toContain('Jane');
    expect(result.supervisor.output.verdict).toBe('PASS');
    expect(result.supervisor.output.requiredApproval).toBe(true);
  });
});
