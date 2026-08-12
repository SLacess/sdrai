import { describe, expect, it } from 'vitest';
import { AIGateway } from '../../gateway/gateway';
import { StubProvider } from '../../gateway/stub-provider';
import type { ProviderRawResponse } from '../../gateway/types';
import { loadAgentSystemPrompt } from '../../prompts';
import { allocateEvidenceIds } from '../shared/evidence-allocation';
import { runResearchAgent } from './pipeline';

function goodResponse(evidenceId: string): ProviderRawResponse {
  return {
    text: JSON.stringify({
      runId: '11111111-1111-4111-8111-111111111111',
      agent: 'research_agent',
      agentVersion: '1.0.0',
      status: 'success',
      confidence: 0.9,
      createdAt: '2026-08-11T00:00:00.000Z',
      facts: [{ claim: 'Acme uses WordPress', evidenceId }],
      dossier: { summary: 'Retailer', digitalAssets: ['acme.com'], initiatives: [], sourceCoverage: 0.8 },
    }),
    model: 'claude-sonnet-5',
    tokensInput: 200,
    tokensOutput: 50,
  };
}

describe('runResearchAgent', () => {
  it('invokes the gateway with the research_agent schema and the versioned system prompt', async () => {
    const sources = allocateEvidenceIds([{ sourceUri: 'https://acme.com', rawContent: 'Acme is a retailer.' }]);
    let capturedSystemPrompt = '';
    let capturedUserPrompt = '';
    const provider = new StubProvider((request) => {
      capturedSystemPrompt = request.systemPrompt;
      capturedUserPrompt = request.userPrompt;
      return goodResponse(sources[0]?.evidenceId ?? '');
    });
    const gateway = new AIGateway({ primary: provider });

    const result = await runResearchAgent({ gateway, accountName: 'Acme', accountDomain: 'acme.com', sources });

    expect(result.output.dossier.summary).toBe('Retailer');
    expect(result.output.facts[0]?.evidenceId).toBe(sources[0]?.evidenceId);
    expect(capturedSystemPrompt).toBe(loadAgentSystemPrompt('research_agent'));
    expect(capturedUserPrompt).toContain('Acme is a retailer.');
    expect(capturedUserPrompt).toContain(sources[0]?.evidenceId ?? '');
  });
});
