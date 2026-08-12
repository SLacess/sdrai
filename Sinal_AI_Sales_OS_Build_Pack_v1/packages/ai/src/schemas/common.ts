import { z } from 'zod';
export const Confidence = z.number().min(0).max(1);
export const EvidenceRef = z.object({ evidenceId:z.string().uuid(), claim:z.string().min(1) });
export const Fact = z.object({ claim:z.string().min(1), evidenceId:z.string().uuid() });
export const Inference = z.object({ claim:z.string().min(1), confidence:Confidence, basisEvidenceIds:z.array(z.string().uuid()).default([]) });
export const RecommendedAction = z.object({ type:z.string(), rationale:z.string(), risk:z.enum(['GREEN','YELLOW','RED']) });
export const AgentEnvelopeBase = z.object({
  runId:z.string().uuid(), agent:z.string(), agentVersion:z.string(), entityId:z.string().uuid().optional(),
  status:z.enum(['success','partial','blocked']), confidence:Confidence,
  facts:z.array(Fact).default([]), inferences:z.array(Inference).default([]), recommendedActions:z.array(RecommendedAction).default([]),
  policyFlags:z.array(z.string()).default([]), modelMetadata:z.record(z.unknown()).default({}), createdAt:z.string().datetime()
});
