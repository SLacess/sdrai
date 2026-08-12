import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { CrmSyncOutput } from '../../schemas/agents';
import { buildCrmSyncPrompt, type CrmSyncPromptInput } from './prompt';

const CRM_SYNC_AGENT_VERSION = '1.0.0';

export interface RunCrmSyncAgentParams extends CrmSyncPromptInput {
  gateway: AIGateway;
}

export function runCrmSyncAgent(params: RunCrmSyncAgentParams) {
  return params.gateway.invoke({
    agent: 'crm_sync_agent',
    agentVersion: CRM_SYNC_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('crm_sync_agent'),
    userPrompt: buildCrmSyncPrompt(params),
    schema: CrmSyncOutput,
  });
}
