import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { AiSupervisorOutput } from '../../schemas/agents';
import { buildTrustedEvidenceSummaryList, type EvidenceSummary } from '../shared/prompt-parts';

export interface RunAiSupervisorParams {
  gateway: AIGateway;
  draftBody: string;
  claims: readonly string[];
  citedEvidenceIds: readonly string[];
  validEvidence: readonly EvidenceSummary[];
}

export function buildAiSupervisorPrompt(params: Omit<RunAiSupervisorParams, 'gateway'>): string {
  return [
    'TRUSTED INTERNAL CONTEXT:',
    'draft_body:',
    params.draftBody,
    '',
    'claims_in_draft:',
    params.claims.map((claim) => `- ${claim}`).join('\n'),
    '',
    'cited_evidence_ids:',
    params.citedEvidenceIds.map((id) => `- ${id}`).join('\n'),
    '',
    'Currently valid (unexpired) evidence — any cited id NOT in this list is stale or unsupported:',
    buildTrustedEvidenceSummaryList(params.validEvidence),
  ].join('\n');
}

export function runAiSupervisor(params: RunAiSupervisorParams) {
  return params.gateway.invoke({
    agent: 'ai_supervisor',
    agentVersion: '1.0.0',
    systemPrompt: loadAgentSystemPrompt('ai_supervisor'),
    userPrompt: buildAiSupervisorPrompt(params),
    schema: AiSupervisorOutput,
  });
}
