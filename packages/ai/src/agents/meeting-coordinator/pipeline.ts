import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { MeetingCoordinatorOutput } from '../../schemas/agents';
import { buildMeetingCoordinatorPrompt, type MeetingCoordinatorPromptInput } from './prompt';

const MEETING_COORDINATOR_AGENT_VERSION = '1.0.0';

export interface RunMeetingCoordinatorParams extends MeetingCoordinatorPromptInput {
  gateway: AIGateway;
}

export function runMeetingCoordinator(params: RunMeetingCoordinatorParams) {
  return params.gateway.invoke({
    agent: 'meeting_coordinator',
    agentVersion: MEETING_COORDINATOR_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('meeting_coordinator'),
    userPrompt: buildMeetingCoordinatorPrompt(params),
    schema: MeetingCoordinatorOutput,
  });
}
