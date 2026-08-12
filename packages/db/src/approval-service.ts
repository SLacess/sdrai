import type { Approval, ApprovalStatus, EntityType, Prisma, PrismaClient, RiskLevel } from '@prisma/client';

export interface CreateApprovalInput {
  actionType: string;
  entityType: EntityType;
  entityId: string;
  payload: Prisma.InputJsonValue;
  riskLevel: RiskLevel;
  rationale: string;
  confidence?: number;
  messageDraftId?: string;
  expiresAt?: Date;
}

export interface ListPendingApprovalsParams {
  limit?: number;
}

export async function listPendingApprovals(
  prisma: PrismaClient,
  params: ListPendingApprovalsParams = {},
): Promise<Approval[]> {
  return prisma.approval.findMany({
    where: { status: 'PENDING' },
    orderBy: [{ riskLevel: 'desc' }, { createdAt: 'asc' }],
    take: params.limit ?? 50,
  });
}

export async function createApproval(prisma: PrismaClient, input: CreateApprovalInput): Promise<Approval> {
  return prisma.approval.create({
    data: {
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      riskLevel: input.riskLevel,
      rationale: input.rationale,
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.messageDraftId !== undefined ? { messageDraftId: input.messageDraftId } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    },
  });
}

export type ApprovalDecision = 'APPROVE' | 'EDIT' | 'REJECT';

export interface DecideApprovalInput {
  approvalId: string;
  reviewerUserId: string;
  decision: ApprovalDecision;
  editedPayload?: Prisma.InputJsonValue;
  reason?: string;
}

export type DecideApprovalOutcome =
  | { kind: 'DECIDED'; approval: Approval }
  | { kind: 'CONFLICT'; currentStatus: ApprovalStatus }
  | { kind: 'NOT_FOUND' };

const DECISION_TO_STATUS: Record<ApprovalDecision, ApprovalStatus> = {
  APPROVE: 'APPROVED',
  EDIT: 'EDITED',
  REJECT: 'REJECTED',
};

/**
 * A decision can only ever land once: the update is a compare-and-swap on
 * status=PENDING, so a repeated/concurrent decision call always resolves to
 * CONFLICT instead of silently overwriting an earlier decision (BP-020:
 * "Decision is auditable and cannot be repeated").
 */
export async function decideApproval(prisma: PrismaClient, input: DecideApprovalInput): Promise<DecideApprovalOutcome> {
  const existing = await prisma.approval.findUnique({ where: { id: input.approvalId } });
  if (!existing) return { kind: 'NOT_FOUND' };

  const isExpired = existing.expiresAt !== null && existing.expiresAt.getTime() <= Date.now();
  if (existing.status !== 'PENDING' || isExpired) {
    if (isExpired && existing.status === 'PENDING') {
      await prisma.approval.updateMany({ where: { id: input.approvalId, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      return { kind: 'CONFLICT', currentStatus: 'EXPIRED' };
    }
    return { kind: 'CONFLICT', currentStatus: existing.status };
  }

  const updated = await prisma.approval.updateMany({
    where: { id: input.approvalId, status: 'PENDING' },
    data: {
      status: DECISION_TO_STATUS[input.decision],
      reviewerUserId: input.reviewerUserId,
      decisionAt: new Date(),
      ...(input.editedPayload !== undefined ? { editedPayload: input.editedPayload } : {}),
      ...(input.reason !== undefined ? { decisionReason: input.reason } : {}),
    },
  });

  if (updated.count === 0) {
    const raced = await prisma.approval.findUnique({ where: { id: input.approvalId } });
    return { kind: 'CONFLICT', currentStatus: raced?.status ?? 'EXPIRED' };
  }

  const approval = await prisma.approval.findUniqueOrThrow({ where: { id: input.approvalId } });
  return { kind: 'DECIDED', approval };
}
