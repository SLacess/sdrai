import type { Approval, MessageDraft, MessageStatus, Prisma, PolicyOutcome, PrismaClient, RiskLevel } from '@prisma/client';
import { evaluateAction, type PolicyDecisionResult } from '@sinal/policies';
import { findForbiddenClaim } from '@sinal/domain';
import { createApproval } from './approval-service';
import { verifyRequiredEvidence } from './evidence-service';
import { getPolicyConfig, POLICY_CONFIG_KEYS } from './policy-config-service';

export interface FirstTouchClaim {
  text: string;
  support: Array<{ evidenceId: string }>;
}

export interface CreateFirstTouchDraftParams {
  contactId: string;
  campaignId?: string;
  angle: string;
  subject?: string;
  body: string;
  language: string;
  promptVersion: string;
  evidenceIds: string[];
  knowledgeItemIds: string[];
  claims: FirstTouchClaim[];
  confidence: number;
  /** From the ai_supervisor agent — a BLOCK verdict is a hard stop, never softened into REQUIRE_APPROVAL. */
  supervisorVerdict: 'PASS' | 'REVIEW' | 'BLOCK';
  unsupportedClaims: string[];
  supervisorReasons: string[];
  accountVip: boolean;
  hasSuppression: boolean;
  frequencyCapOk: boolean;
  verifiedChannel: boolean;
  inboundPending: boolean;
}

export interface CreateFirstTouchDraftResult {
  messageDraft: MessageDraft;
  approval: Approval | null;
  policyDecision: PolicyDecisionResult;
}

async function createDraftRow(
  prisma: PrismaClient,
  params: CreateFirstTouchDraftParams,
  riskLevel: RiskLevel,
  policyState: PolicyOutcome,
  status: MessageStatus,
): Promise<MessageDraft> {
  return prisma.messageDraft.create({
    data: {
      contactId: params.contactId,
      ...(params.campaignId !== undefined ? { campaignId: params.campaignId } : {}),
      angle: params.angle,
      ...(params.subject !== undefined ? { subject: params.subject } : {}),
      body: params.body,
      confidence: params.confidence,
      riskLevel,
      policyState,
      status,
      language: params.language,
      promptVersion: params.promptVersion,
      evidence: { create: params.evidenceIds.map((evidenceId) => ({ evidenceId })) },
      knowledge: { create: params.knowledgeItemIds.map((knowledgeItemId) => ({ knowledgeItemId })) },
    },
  });
}

/**
 * First touch is always at least YELLOW (config/defaults.yaml
 * autonomy.firstTouch), so this can only ever produce PENDING_APPROVAL or
 * CANCELLED — never SENT/QUEUED. "No first touch can send without an
 * approved Approval" holds structurally: REQUIRE_APPROVAL always creates one
 * (BP-020's decideApproval), and nothing in this file (or downstream send
 * code, once built) is allowed to skip straight to sending.
 */
export async function createFirstTouchDraft(
  prisma: PrismaClient,
  params: CreateFirstTouchDraftParams,
): Promise<CreateFirstTouchDraftResult> {
  const forbiddenClaimsConfig = await getPolicyConfig(prisma, POLICY_CONFIG_KEYS.forbiddenClaims);
  const forbiddenPhrases = Array.isArray(forbiddenClaimsConfig.value) ? (forbiddenClaimsConfig.value as string[]) : [];
  const forbiddenMatch = findForbiddenClaim(`${params.subject ?? ''} ${params.body}`, forbiddenPhrases);
  if (forbiddenMatch) {
    const messageDraft = await createDraftRow(prisma, params, 'RED', 'BLOCK', 'CANCELLED');
    return {
      messageDraft,
      approval: null,
      policyDecision: {
        outcome: 'BLOCK',
        riskLevel: 'RED',
        rulesTriggered: ['FORBIDDEN_CLAIM'],
        reason: `Draft contains a forbidden claim: "${forbiddenMatch}"`,
      },
    };
  }

  if (params.supervisorVerdict === 'BLOCK') {
    const messageDraft = await createDraftRow(prisma, params, 'RED', 'BLOCK', 'CANCELLED');
    return {
      messageDraft,
      approval: null,
      policyDecision: {
        outcome: 'BLOCK',
        riskLevel: 'RED',
        rulesTriggered: ['SUPERVISOR_BLOCK'],
        reason: params.supervisorReasons.join('; ') || 'AI supervisor blocked this draft',
      },
    };
  }

  const evidenceCheck = await verifyRequiredEvidence(prisma, params.evidenceIds);

  const policyDecision = evaluateAction({
    action: 'send_first_touch',
    actionClass: 'YELLOW',
    confidence: params.confidence,
    accountVip: params.accountVip,
    hasSuppression: params.hasSuppression,
    frequencyCapOk: params.frequencyCapOk,
    requiredEvidencePresent: evidenceCheck.allPresent,
    verifiedChannel: params.verifiedChannel,
    inboundPending: params.inboundPending,
    containsTechnicalOrLegalClaim: params.unsupportedClaims.length > 0,
    approvedKnowledgeForClaim: false,
    isFirstTouch: true,
    isCustomPricing: false,
    isContractLegalSecurity: false,
    isDemoOrNegotiation: false,
  });

  const status: MessageStatus = policyDecision.outcome === 'BLOCK' ? 'CANCELLED' : 'PENDING_APPROVAL';
  const messageDraft = await createDraftRow(prisma, params, policyDecision.riskLevel, policyDecision.outcome, status);

  if (policyDecision.outcome !== 'REQUIRE_APPROVAL') {
    return { messageDraft, approval: null, policyDecision };
  }

  const approval = await createApproval(prisma, {
    actionType: 'SEND_FIRST_TOUCH',
    entityType: 'MESSAGE',
    entityId: messageDraft.id,
    payload: {
      subject: params.subject ?? null,
      body: params.body,
      evidenceIds: params.evidenceIds,
      claims: params.claims,
    } as unknown as Prisma.InputJsonValue,
    riskLevel: policyDecision.riskLevel,
    rationale: policyDecision.reason,
    confidence: params.confidence,
    messageDraftId: messageDraft.id,
  });

  return { messageDraft, approval, policyDecision };
}
