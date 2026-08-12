import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import type { ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { runQualificationAgent } from './pipeline';

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 120, tokensOutput: 40 };
}

function envelope(overrides: Record<string, unknown>) {
  return {
    runId: '11111111-1111-4111-8111-111111111111',
    agent: 'qualification_agent',
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.85,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('runQualificationAgent', () => {
  it('invokes the gateway with the qualification_agent schema and versioned system prompt', async () => {
    let capturedSystemPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      return response(
        envelope({
          qualification: {
            fit: true,
            relevantPerson: true,
            need: 'Accessibility remediation',
            scope: { channels: ['web'] },
            engagement: 'positive',
            timing: null,
            blockers: [],
            missingFields: [],
            isSql: true,
            handoffReason: null,
            nextQuestion: null,
          },
        }),
      );
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runQualificationAgent({
      gateway,
      contactName: 'Jane Doe',
      accountName: 'Acme',
      accountScore: 80,
      conversationHistory: 'We are interested, please send a proposal.',
    });

    expect(result.output.qualification.need).toBe('Accessibility remediation');
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('qualification_agent'));
  });
});
