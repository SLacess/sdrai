import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import type { ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { runCrmSyncAgent } from './pipeline';

function response(body: unknown): ProviderRawResponse {
  return { text: JSON.stringify(body), model: 'claude-sonnet-5', tokensInput: 90, tokensOutput: 30 };
}

function envelope(overrides: Record<string, unknown>) {
  return {
    runId: '11111111-1111-4111-8111-111111111111',
    agent: 'crm_sync_agent',
    agentVersion: '1.0.0',
    status: 'success',
    confidence: 0.9,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('runCrmSyncAgent', () => {
  it('invokes the gateway with the crm_sync_agent schema and versioned system prompt', async () => {
    let capturedSystemPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      return response(
        envelope({
          operations: [
            { object: 'COMPANY', operation: 'UPDATE', externalId: 'hs-1', fields: { name: 'Acme' }, authoritativeConflicts: [] },
          ],
        }),
      );
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runCrmSyncAgent({
      gateway,
      records: [{ object: 'COMPANY', externalId: 'hs-1', localFields: { name: 'Acme' }, hubspotFields: { name: 'Acme Old' } }],
      authoritativeFieldsByObject: { COMPANY: ['ownerId'] },
    });

    expect(result.output.operations[0]?.operation).toBe('UPDATE');
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('crm_sync_agent'));
  });
});
