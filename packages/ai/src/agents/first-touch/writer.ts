import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { PersonalizationWriterOutput } from '../../schemas/agents';
import { buildTrustedEvidenceSummaryList, type EvidenceSummary } from '../shared/prompt-parts';

export interface RunPersonalizationWriterParams {
  gateway: AIGateway;
  contactName: string;
  accountName: string;
  angleName: string;
  problemFrame: string;
  cta: string;
  language: 'pt-BR' | 'es' | 'en';
  evidence: readonly EvidenceSummary[];
  knowledgeItems: readonly EvidenceSummary[];
}

export function buildPersonalizationWriterPrompt(params: Omit<RunPersonalizationWriterParams, 'gateway'>): string {
  return [
    'TRUSTED INTERNAL CONTEXT:',
    `contact_name: ${params.contactName}`,
    `account_name: ${params.accountName}`,
    `angle: ${params.angleName}`,
    `problem_frame: ${params.problemFrame}`,
    `cta: ${params.cta}`,
    `language: ${params.language}`,
    '',
    'Available evidence. Every specific claim in the draft must cite one of these evidenceId values:',
    buildTrustedEvidenceSummaryList(params.evidence),
    '',
    'Available approved knowledge items. Cite ONLY these knowledgeItemId values; do not invent new ones:',
    buildTrustedEvidenceSummaryList(params.knowledgeItems),
  ].join('\n');
}

export function runPersonalizationWriter(params: RunPersonalizationWriterParams) {
  return params.gateway.invoke({
    agent: 'personalization_writer',
    agentVersion: '1.0.0',
    systemPrompt: loadAgentSystemPrompt('personalization_writer'),
    userPrompt: buildPersonalizationWriterPrompt(params),
    schema: PersonalizationWriterOutput,
  });
}
