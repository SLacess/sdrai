import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { ResearchOutput } from '../../schemas/agents';
import type { AllocatedSource } from '../shared/evidence-allocation';
import { buildResearchUserPrompt } from './prompt';

const RESEARCH_AGENT_VERSION = '1.0.0';

export interface RunResearchAgentParams {
  gateway: AIGateway;
  accountName: string;
  accountDomain: string;
  sources: readonly AllocatedSource[];
}

export function runResearchAgent(params: RunResearchAgentParams) {
  return params.gateway.invoke({
    agent: 'research_agent',
    agentVersion: RESEARCH_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('research_agent'),
    userPrompt: buildResearchUserPrompt({
      accountName: params.accountName,
      accountDomain: params.accountDomain,
      sources: params.sources,
    }),
    schema: ResearchOutput,
  });
}
