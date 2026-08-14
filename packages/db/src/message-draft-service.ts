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

export interface CreateMessageDraftParams {
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

/** @deprecated use {@link CreateMessageDraftParams} — kept as an alias so existing imports keep working. */
export type CreateFirstTouchDraftParams = CreateMessageDraftParams;
export type CreateReplyDraftParams = CreateMessageDraftParams;

export interface CreateMessageDraftResult {
  messageDraft: MessageDraft;
  approval: Approval | null;
  policyDecision: PolicyDecisionResult;
}

/** @deprecated use {@link CreateMessageDraftResult} — kept as an alias so existing imports keep working. */
export type CreateFirstTouchDraftResult = CreateMessageDraftResult;
export type CreateReplyDraftResult = CreateMessageDraftResult;

async function createDraftRow(
  prisma: PrismaClient,
  params: CreateMessageDraftParams,
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

interface CreateMessageDraftOptions {
  /** Approval.actionType — distinguishes what a reviewer is approving in the Approval Center. */
  actionType: 'SEND_FIRST_TOUCH' | 'SEND_REPLY';
  /** Policy action name passed to evaluateAction, for rule-trace readability only. */
  policyAction: string;
  /** Only first touch gets the FIRST_TOUCH policy rule tag — everything else about the YELLOW gate is identical. */
  isFirstTouch: boolean;
}

/**
 * Shared by createFirstTouchDraft and createReplyDraft: both are always at
 * least YELLOW (config/defaults.yaml autonomy.firstTouch — replies inherit
 * the same "no explicit autonomy promotion yet" default), so this can only
 * ever produce PENDING_APPROVAL or CANCELLED — never SENT/QUEUED. "No
 * message can send without an approved Approval" holds structurally:
 * REQUIRE_APPROVAL always creates one (BP-020's decideApproval), and nothing
 * in this file (or downstream send code) is allowed to skip straight to
 * sending.
 */
async function createMessageDraft(
  prisma: PrismaClient,
  params: CreateMessageDraftParams,
  options: CreateMessageDraftOptions,
): Promise<CreateMessageDraftResult> {
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
    action: options.policyAction,
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
    isFirstTouch: options.isFirstTouch,
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
    actionType: options.actionType,
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

export async function createFirstTouchDraft(
  prisma: PrismaClient,
  params: CreateMessageDraftParams,
): Promise<CreateMessageDraftResult> {
  return createMessageDraft(prisma, params, {
    actionType: 'SEND_FIRST_TOUCH',
    policyAction: 'send_first_touch',
    isFirstTouch: true,
  });
}

/**
 * Drafts a reply to an inbound message. Contrary to the "isFirstTouch" YELLOW
 * rule this doesn't share a name with, a reply gets exactly the same
 * approval gate today — there's no autonomy-promotion rule for replies yet
 * (CLAUDE.md rule 8 only carves out an explicit exception for promoted
 * first-touch autonomy), so it defaults to requiring a human the same way.
 */
export async function createReplyDraft(
  prisma: PrismaClient,
  params: CreateMessageDraftParams,
): Promise<CreateMessageDraftResult> {
  return createMessageDraft(prisma, params, {
    actionType: 'SEND_REPLY',
    policyAction: 'send_reply',
    isFirstTouch: false,
  });
}
