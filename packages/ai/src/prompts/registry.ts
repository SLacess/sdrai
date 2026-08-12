import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROMPT_FILENAMES = {
  account_hunter: '01-account-hunter.md',
  research_agent: '02-research-agent.md',
  accessibility_intelligence: '03-accessibility-intelligence.md',
  buying_committee_mapper: '04-buying-committee.md',
  scoring_agent: '05-scoring-agent.md',
  message_angle_agent: '06-message-angle.md',
  personalization_writer: '07-personalization-writer.md',
  outreach_scheduler: '08-outreach-scheduler.md',
  reply_classifier: '09-reply-classifier.md',
  reply_composer: '10-reply-composer.md',
  qualification_agent: '11-qualification-agent.md',
  meeting_coordinator: '12-meeting-coordinator.md',
  meeting_prep_agent: '13-meeting-prep.md',
  crm_sync_agent: '14-crm-sync.md',
  ai_supervisor: '15-ai-supervisor.md',
  learning_analyst: '16-learning-analyst.md',
} as const;

export type PromptAgentName = keyof typeof PROMPT_FILENAMES;

const PROMPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'prompts');

const cache = new Map<PromptAgentName, string>();

/** Reads and caches the versioned system prompt markdown for one agent. */
export function loadAgentSystemPrompt(agent: PromptAgentName): string {
  const cached = cache.get(agent);
  if (cached !== undefined) return cached;
  const content = readFileSync(path.join(PROMPTS_DIR, PROMPT_FILENAMES[agent]), 'utf8');
  cache.set(agent, content);
  return content;
}
