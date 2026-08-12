import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import { AIGatewayError, type ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { runLearningAnalyst } from './pipeline';

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 200, tokensOutput: 80 };
}

function envelope(overrides: Record<string, unknown>) {
  return {
    runId: '11111111-1111-4111-8111-111111111111',
    agent: 'learning_analyst',
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.8,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

const BASE_INPUT = {
  windowStart: '2026-08-04',
  windowEnd: '2026-08-11',
  sampleSize: 42,
  approvalOutcomeCounts: { APPROVED: 30, REJECTED: 5 },
  conversionCounts: { SQL: 8 },
  agentFailureCounts: {},
  evalFailureSummaries: [],
};

describe('runLearningAnalyst', () => {
  it('invokes the gateway with the learning_analyst schema and versioned system prompt', async () => {
    let capturedSystemPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      return response(
        envelope({
          proposals: [
            {
              type: 'THRESHOLD',
              currentVersion: 'v1',
              proposal: 'Raise SQL confidence threshold from 0.75 to 0.8',
              evidence: ['approval_reject_rate_up'],
              expectedImpact: 'Fewer low-quality SQL handoffs',
              risk: 'LOW',
              requiresOfflineEval: true,
            },
          ],
        }),
      );
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runLearningAnalyst({ gateway, ...BASE_INPUT });

    expect(result.output.proposals[0]?.requiresOfflineEval).toBe(true);
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('learning_analyst'));
  });

  it('rejects (never accepts) a proposal that claims it does not require offline eval', async () => {
    const provider = new StubProvider(() =>
      response(
        envelope({
          proposals: [
            {
              type: 'PROMPT',
              currentVersion: 'v3',
              proposal: 'Skip eval and ship directly',
              evidence: [],
              expectedImpact: 'Faster iteration',
              risk: 'HIGH',
              requiresOfflineEval: false,
            },
          ],
        }),
      ),
    );
    const gateway = new AIGateway({ primary: provider, maxRetries: 0 });

    await expect(runLearningAnalyst({ gateway, ...BASE_INPUT })).rejects.toBeInstanceOf(AIGatewayError);
  });
});
