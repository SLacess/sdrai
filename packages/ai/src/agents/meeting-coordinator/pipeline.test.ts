import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import type { ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { runMeetingCoordinator } from './pipeline';

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 100, tokensOutput: 30 };
}

function envelope(overrides: Record<string, unknown>) {
  return {
    runId: '11111111-1111-4111-8111-111111111111',
    agent: 'meeting_coordinator',
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.9,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('runMeetingCoordinator', () => {
  it('invokes the gateway with the meeting_coordinator schema and versioned system prompt', async () => {
    let capturedSystemPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      return response(
        envelope({
          action: 'PROPOSE_SLOTS',
          slots: ['2026-08-12T14:00:00.000Z'],
          timezone: 'America/Sao_Paulo',
          participants: [],
          escalationReason: null,
        }),
      );
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runMeetingCoordinator({
      gateway,
      contactName: 'Jane Doe',
      accountName: 'Acme',
      confirmedTimezone: 'America/Sao_Paulo',
      availableSlots: ['2026-08-12T14:00:00Z'],
      meetingRequestText: 'Wednesday works.',
    });

    expect(result.output.action).toBe('PROPOSE_SLOTS');
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('meeting_coordinator'));
  });
});
