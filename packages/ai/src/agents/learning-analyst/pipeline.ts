import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { LearningAnalystOutput } from '../../schemas/agents';
import { buildLearningAnalystPrompt, type LearningAnalystPromptInput } from './prompt';

const LEARNING_ANALYST_AGENT_VERSION = '1.0.0';

export interface RunLearningAnalystParams extends LearningAnalystPromptInput {
  gateway: AIGateway;
}

export function runLearningAnalyst(params: RunLearningAnalystParams) {
  return params.gateway.invoke({
    agent: 'learning_analyst',
    agentVersion: LEARNING_ANALYST_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('learning_analyst'),
    userPrompt: buildLearningAnalystPrompt(params),
    schema: LearningAnalystOutput,
  });
}
