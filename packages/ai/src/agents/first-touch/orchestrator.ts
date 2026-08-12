import type { AIGateway } from '../../gateway';
import type { EvidenceSummary } from '../shared/prompt-parts';
import { runMessageAngleAgent } from './angle';
import { runAiSupervisor } from './supervisor';
import { runPersonalizationWriter } from './writer';

export interface RunFirstTouchPipelineParams {
  gateway: AIGateway;
  contactName: string;
  contactTitle?: string;
  accountName: string;
  language: 'pt-BR' | 'es' | 'en';
  evidence: readonly EvidenceSummary[];
  knowledgeItems: readonly EvidenceSummary[];
  validEvidence: readonly EvidenceSummary[];
}

/**
 * Chains angle -> writer -> supervisor sequentially, each a separate
 * schema-validated AIGateway call. This function only observes/recommends —
 * it never sends anything; the caller (packages/db message-draft-service)
 * is the one that runs the Policy Engine and decides ALLOW/REQUIRE_APPROVAL.
 */
export async function runFirstTouchPipeline(params: RunFirstTouchPipelineParams) {
  const angle = await runMessageAngleAgent({
    gateway: params.gateway,
    contactName: params.contactName,
    ...(params.contactTitle !== undefined ? { contactTitle: params.contactTitle } : {}),
    accountName: params.accountName,
    evidence: params.evidence,
  });

  const draft = await runPersonalizationWriter({
    gateway: params.gateway,
    contactName: params.contactName,
    accountName: params.accountName,
    angleName: angle.output.angle.name,
    problemFrame: angle.output.angle.problemFrame,
    cta: angle.output.angle.cta,
    language: params.language,
    evidence: params.evidence,
    knowledgeItems: params.knowledgeItems,
  });

  const supervisor = await runAiSupervisor({
    gateway: params.gateway,
    draftBody: draft.output.draft.body,
    claims: draft.output.draft.claims.map((claim) => claim.text),
    citedEvidenceIds: draft.output.draft.evidenceIds,
    validEvidence: params.validEvidence,
  });

  return { angle, draft, supervisor };
}
