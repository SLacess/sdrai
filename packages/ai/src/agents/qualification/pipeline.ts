import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { QualificationOutput } from '../../schemas/agents';
import { buildQualificationPrompt, type QualificationPromptInput } from './prompt';

const QUALIFICATION_AGENT_VERSION = '1.0.0';

export interface RunQualificationAgentParams extends QualificationPromptInput {
  gateway: AIGateway;
}

export function runQualificationAgent(params: RunQualificationAgentParams) {
  return params.gateway.invoke({
    agent: 'qualification_agent',
    agentVersion: QUALIFICATION_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('qualification_agent'),
    userPrompt: buildQualificationPrompt(params),
    schema: QualificationOutput,
  });
}
