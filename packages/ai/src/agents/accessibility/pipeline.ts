import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { AccessibilityIntelligenceOutput } from '../../schemas/agents';
import type { AllocatedSource } from '../shared/evidence-allocation';
import { buildAccessibilityUserPrompt } from './prompt';

const ACCESSIBILITY_AGENT_VERSION = '1.0.0';

export interface RunAccessibilityIntelligenceParams {
  gateway: AIGateway;
  accountName: string;
  accountDomain: string;
  findings: readonly AllocatedSource[];
}

export function runAccessibilityIntelligence(params: RunAccessibilityIntelligenceParams) {
  return params.gateway.invoke({
    agent: 'accessibility_intelligence',
    agentVersion: ACCESSIBILITY_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('accessibility_intelligence'),
    userPrompt: buildAccessibilityUserPrompt({
      accountName: params.accountName,
      accountDomain: params.accountDomain,
      findings: params.findings,
    }),
    schema: AccessibilityIntelligenceOutput,
  });
}
