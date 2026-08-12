import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { ReplyClassifierOutput } from '../../schemas/agents';
import { buildReplyClassifierPrompt, type ReplyClassifierPromptInput } from './prompt';

const REPLY_CLASSIFIER_AGENT_VERSION = '1.0.0';

export interface RunReplyClassifierParams extends ReplyClassifierPromptInput {
  gateway: AIGateway;
}

export function runReplyClassifier(params: RunReplyClassifierParams) {
  return params.gateway.invoke({
    agent: 'reply_classifier',
    agentVersion: REPLY_CLASSIFIER_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('reply_classifier'),
    userPrompt: buildReplyClassifierPrompt(params),
    schema: ReplyClassifierOutput,
  });
}
