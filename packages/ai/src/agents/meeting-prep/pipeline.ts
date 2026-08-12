import type { AIGateway } from '../../gateway';
import { loadAgentSystemPrompt } from '../../prompts';
import { MeetingPrepOutput } from '../../schemas/agents';
import { buildMeetingPrepPrompt, type MeetingPrepPromptInput } from './prompt';

const MEETING_PREP_AGENT_VERSION = '1.0.0';

export interface RunMeetingPrepParams extends MeetingPrepPromptInput {
  gateway: AIGateway;
}

export function runMeetingPrep(params: RunMeetingPrepParams) {
  return params.gateway.invoke({
    agent: 'meeting_prep_agent',
    agentVersion: MEETING_PREP_AGENT_VERSION,
    systemPrompt: loadAgentSystemPrompt('meeting_prep_agent'),
    userPrompt: buildMeetingPrepPrompt(params),
    schema: MeetingPrepOutput,
  });
}
