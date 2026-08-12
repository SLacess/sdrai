import type { ChangeProposal, ChangeProposalStatus, PrismaClient } from '@prisma/client';
import { hasSufficientSampleForProposal } from '@sinal/domain';

export interface LearningProposalInput {
  type: 'PROMPT' | 'WEIGHT' | 'THRESHOLD' | 'PLAYBOOK' | 'SEQUENCE';
  currentVersion: string;
  proposal: string;
  evidence: string[];
  expectedImpact: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PersistChangeProposalsParams {
  agentRunId?: string;
  sampleSize: number;
  proposals: LearningProposalInput[];
}

export type PersistChangeProposalsResult =
  | { kind: 'OBSERVATION_ONLY'; sampleSize: number }
  | { kind: 'PROPOSED'; proposals: ChangeProposal[] };

/**
 * The sample-size gate is re-checked here, not trusted from the agent's own
 * output — "insufficient sample => no proposal / observation only" (WF-16)
 * holds even if the model produced proposals anyway. Every persisted row is
 * always requiresOfflineEval=true and status=PROPOSED; there is no function
 * in this module (or anywhere else) that reads an ACCEPTED proposal and
 * mutates a prompt, weight, or threshold — "never deploy automatically" is
 * true because the deploy path simply does not exist here.
 */
export async function persistChangeProposals(
  prisma: PrismaClient,
  params: PersistChangeProposalsParams,
): Promise<PersistChangeProposalsResult> {
  if (!hasSufficientSampleForProposal(params.sampleSize)) {
    return { kind: 'OBSERVATION_ONLY', sampleSize: params.sampleSize };
  }

  const proposals = await Promise.all(
    params.proposals.map((proposal) =>
      prisma.changeProposal.create({
        data: {
          ...(params.agentRunId !== undefined ? { agentRunId: params.agentRunId } : {}),
          type: proposal.type,
          currentVersion: proposal.currentVersion,
          proposal: proposal.proposal,
          evidence: proposal.evidence,
          expectedImpact: proposal.expectedImpact,
          risk: proposal.risk,
          requiresOfflineEval: true,
          status: 'PROPOSED',
        },
      }),
    ),
  );

  return { kind: 'PROPOSED', proposals };
}

export interface ListChangeProposalsParams {
  status?: ChangeProposalStatus;
  limit?: number;
}

export async function listChangeProposals(
  prisma: PrismaClient,
  params: ListChangeProposalsParams = {},
): Promise<ChangeProposal[]> {
  return prisma.changeProposal.findMany({
    where: params.status !== undefined ? { status: params.status } : {},
    orderBy: { createdAt: 'desc' },
    take: params.limit ?? 50,
  });
}

export type ChangeProposalReviewDecision = 'ACCEPT' | 'REJECT';

export interface DecideChangeProposalParams {
  proposalId: string;
  reviewerUserId: string;
  decision: ChangeProposalReviewDecision;
  reason?: string;
}

export type DecideChangeProposalOutcome =
  | { kind: 'DECIDED'; proposal: ChangeProposal }
  | { kind: 'CONFLICT'; currentStatus: ChangeProposalStatus }
  | { kind: 'NOT_FOUND' };

const DECISION_TO_STATUS: Record<ChangeProposalReviewDecision, ChangeProposalStatus> = {
  ACCEPT: 'ACCEPTED',
  REJECT: 'REJECTED',
};

/**
 * "Accepted" is a review record, not a deploy trigger — deciding a proposal
 * here only ever changes this row's status. Applying the change to a
 * prompt/weight/threshold remains a separate, manual, versioned step
 * outside this pipeline (CLAUDE.md's normal prompt-change workflow).
 */
export async function decideChangeProposal(
  prisma: PrismaClient,
  params: DecideChangeProposalParams,
): Promise<DecideChangeProposalOutcome> {
  const existing = await prisma.changeProposal.findUnique({ where: { id: params.proposalId } });
  if (!existing) return { kind: 'NOT_FOUND' };
  if (existing.status !== 'PROPOSED') {
    return { kind: 'CONFLICT', currentStatus: existing.status };
  }

  const updated = await prisma.changeProposal.updateMany({
    where: { id: params.proposalId, status: 'PROPOSED' },
    data: {
      status: DECISION_TO_STATUS[params.decision],
      reviewerUserId: params.reviewerUserId,
      decidedAt: new Date(),
      ...(params.reason !== undefined ? { decisionReason: params.reason } : {}),
    },
  });

  if (updated.count === 0) {
    const raced = await prisma.changeProposal.findUniqueOrThrow({ where: { id: params.proposalId } });
    return { kind: 'CONFLICT', currentStatus: raced.status };
  }

  const proposal = await prisma.changeProposal.findUniqueOrThrow({ where: { id: params.proposalId } });
  return { kind: 'DECIDED', proposal };
}
