import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import { AIGatewayError, type ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { runReplyClassifier } from './pipeline';

function envelope(overrides: Record<string, unknown>) {
  return {
    runId: '11111111-1111-4111-8111-111111111111',
    agent: 'reply_classifier',
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.9,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 80, tokensOutput: 20 };
}

describe('runReplyClassifier', () => {
  it('invokes the gateway with the reply_classifier schema and versioned system prompt', async () => {
    let capturedSystemPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      return response(
        envelope({
          classification: {
            intent: 'OPT_OUT',
            sentiment: 'NEGATIVE',
            objectionType: null,
            requiresHuman: true,
            pauseSequence: true,
          },
        }),
      );
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runReplyClassifier({ gateway, contactName: 'Jane Doe', channel: 'EMAIL', rawContent: 'Stop.' });

    expect(result.output.classification.intent).toBe('OPT_OUT');
    expect(result.output.classification.pauseSequence).toBe(true);
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('reply_classifier'));
  });

  it('rejects (never accepts) a response claiming pauseSequence=false', async () => {
    const provider = new StubProvider(() =>
      response(
        envelope({
          classification: {
            intent: 'POSITIVE_REPLY',
            sentiment: 'POSITIVE',
            objectionType: null,
            requiresHuman: false,
            pauseSequence: false,
          },
        }),
      ),
    );
    const gateway = new AIGateway({ primary: provider, maxRetries: 0 });

    await expect(
      runReplyClassifier({ gateway, contactName: 'Jane Doe', channel: 'EMAIL', rawContent: 'Sounds good.' }),
    ).rejects.toBeInstanceOf(AIGatewayError);
  });
});
