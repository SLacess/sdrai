import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import { AIGatewayError, type ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { allocateEvidenceIds } from '../shared/evidence-allocation';
import { runAccessibilityIntelligence } from './pipeline';

function envelope(overrides: Record<string, unknown>) {
  return {
    runId: '11111111-1111-4111-8111-111111111111',
    agent: 'accessibility_intelligence',
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.8,
    createdAt: '2026-08-11T00:00:00.000Z',
    opportunityScore: 60,
    disclaimer: 'Automated scan is an indicator, not a compliance declaration.',
    ...overrides,
  };
}

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 150, tokensOutput: 40 };
}

describe('runAccessibilityIntelligence', () => {
  it('invokes the gateway with the accessibility_intelligence schema and versioned system prompt', async () => {
    const findings = allocateEvidenceIds([{ sourceUri: 'scan://acme.com#alt', rawContent: 'rule=image-alt severity=high' }]);
    let capturedSystemPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      return response(
        envelope({
          signals: [
            {
              type: 'image-alt',
              severity: 'high',
              description: 'Missing alt text',
              evidenceIds: [findings[0]?.evidenceId],
              scanIsIndicator: true,
            },
          ],
        }),
      );
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runAccessibilityIntelligence({ gateway, accountName: 'Acme', accountDomain: 'acme.com', findings });

    expect(result.output.signals[0]?.scanIsIndicator).toBe(true);
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('accessibility_intelligence'));
  });

  it('rejects (never accepts) a response that tries to declare compliance via scanIsIndicator=false', async () => {
    const findings = allocateEvidenceIds([{ sourceUri: 'scan://acme.com#alt', rawContent: 'x' }]);
    const provider = new StubProvider(() =>
      response(
        envelope({
          signals: [
            {
              type: 'image-alt',
              severity: 'high',
              description: 'Fully compliant, no issues',
              evidenceIds: [findings[0]?.evidenceId],
              scanIsIndicator: false,
            },
          ],
        }),
      ),
    );
    const gateway = new AIGateway({ primary: provider, maxRetries: 0 });

    await expect(
      runAccessibilityIntelligence({ gateway, accountName: 'Acme', accountDomain: 'acme.com', findings }),
    ).rejects.toBeInstanceOf(AIGatewayError);
  });
});
