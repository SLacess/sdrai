import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { MessageAngleOutput } from '../../schemas/agents';
import { buildTrustedEvidenceSummaryList, type EvidenceSummary } from '../shared/prompt-parts';

export interface RunMessageAngleParams {
  gateway: AIGateway;
  contactName: string;
  contactTitle?: string;
  accountName: string;
  evidence: readonly EvidenceSummary[];
}

export function buildMessageAnglePrompt(params: Omit<RunMessageAngleParams, 'gateway'>): string {
  return [
    'TRUSTED INTERNAL CONTEXT:',
    `contact_name: ${params.contactName}`,
    `contact_title: ${params.contactTitle ?? 'unknown'}`,
    `account_name: ${params.accountName}`,
    '',
    'Available evidence. Cite ONLY these evidenceId values; do not invent new ones:',
    buildTrustedEvidenceSummaryList(params.evidence),
  ].join('\n');
}

export function runMessageAngleAgent(params: RunMessageAngleParams) {
  return params.gateway.invoke({
    agent: 'message_angle_agent',
    agentVersion: '1.0.0',
    systemPrompt: loadAgentSystemPrompt('message_angle_agent'),
    userPrompt: buildMessageAnglePrompt(params),
    schema: MessageAngleOutput,
  });
}
