import type { KnowledgeApprovalState, KnowledgeItem, KnowledgeType, PrismaClient } from '@prisma/client';
import { isKnowledgeItemUsable } from '@sinal/domain';

export interface CreateKnowledgeItemParams {
  type: KnowledgeType;
  title: string;
  content: string;
  sourceRef?: string;
  tags?: string[];
  jurisdiction?: string;
  validFrom?: Date;
  validUntil?: Date;
}

/** New items always start DRAFT, version 1 — nothing is usable externally until approveKnowledgeItem runs. */
export async function createKnowledgeItem(prisma: PrismaClient, params: CreateKnowledgeItemParams): Promise<KnowledgeItem> {
  return prisma.knowledgeItem.create({
    data: {
      type: params.type,
      title: params.title,
      content: params.content,
      tags: params.tags ?? [],
      approvalState: 'DRAFT',
      version: 1,
      ...(params.sourceRef !== undefined ? { sourceRef: params.sourceRef } : {}),
      ...(params.jurisdiction !== undefined ? { jurisdiction: params.jurisdiction } : {}),
      ...(params.validFrom !== undefined ? { validFrom: params.validFrom } : {}),
      ...(params.validUntil !== undefined ? { validUntil: params.validUntil } : {}),
    },
  });
}

export type KnowledgeStateOutcome =
  | { kind: 'UPDATED'; item: KnowledgeItem }
  | { kind: 'CONFLICT'; currentState: KnowledgeApprovalState }
  | { kind: 'NOT_FOUND' };

export async function approveKnowledgeItem(
  prisma: PrismaClient,
  params: { id: string; approvedByUserId: string },
): Promise<KnowledgeStateOutcome> {
  const existing = await prisma.knowledgeItem.findUnique({ where: { id: params.id } });
  if (!existing) return { kind: 'NOT_FOUND' };
  if (existing.approvalState !== 'DRAFT') return { kind: 'CONFLICT', currentState: existing.approvalState };

  const updated = await prisma.knowledgeItem.updateMany({
    where: { id: params.id, approvalState: 'DRAFT' },
    data: { approvalState: 'APPROVED', approvedBy: params.approvedByUserId, approvedAt: new Date() },
  });
  if (updated.count === 0) {
    const raced = await prisma.knowledgeItem.findUniqueOrThrow({ where: { id: params.id } });
    return { kind: 'CONFLICT', currentState: raced.approvalState };
  }
  const item = await prisma.knowledgeItem.findUniqueOrThrow({ where: { id: params.id } });
  return { kind: 'UPDATED', item };
}

/** Only an APPROVED item can be deprecated — a DRAFT is edited or discarded, never "deprecated". */
export async function deprecateKnowledgeItem(prisma: PrismaClient, params: { id: string }): Promise<KnowledgeStateOutcome> {
  const existing = await prisma.knowledgeItem.findUnique({ where: { id: params.id } });
  if (!existing) return { kind: 'NOT_FOUND' };
  if (existing.approvalState !== 'APPROVED') return { kind: 'CONFLICT', currentState: existing.approvalState };

  const updated = await prisma.knowledgeItem.updateMany({
    where: { id: params.id, approvalState: 'APPROVED' },
    data: { approvalState: 'DEPRECATED' },
  });
  if (updated.count === 0) {
    const raced = await prisma.knowledgeItem.findUniqueOrThrow({ where: { id: params.id } });
    return { kind: 'CONFLICT', currentState: raced.approvalState };
  }
  const item = await prisma.knowledgeItem.findUniqueOrThrow({ where: { id: params.id } });
  return { kind: 'UPDATED', item };
}

export interface CreateKnowledgeItemVersionParams {
  id: string;
  content: string;
  sourceRef?: string;
  tags?: string[];
  validFrom?: Date;
  validUntil?: Date;
}

export type CreateKnowledgeItemVersionOutcome = { kind: 'CREATED'; item: KnowledgeItem } | { kind: 'NOT_FOUND' };

/**
 * Versioning never mutates an APPROVED row in place — it creates a new
 * DRAFT row at version+1, inheriting type/title/tags/jurisdiction from the
 * source. The old APPROVED version keeps serving reads (listUsableKnowledgeItems)
 * until the new version is itself approved and the old one is explicitly
 * deprecated; there is no automatic cutover.
 */
export async function createKnowledgeItemVersion(
  prisma: PrismaClient,
  params: CreateKnowledgeItemVersionParams,
): Promise<CreateKnowledgeItemVersionOutcome> {
  const existing = await prisma.knowledgeItem.findUnique({ where: { id: params.id } });
  if (!existing) return { kind: 'NOT_FOUND' };

  const item = await prisma.knowledgeItem.create({
    data: {
      type: existing.type,
      title: existing.title,
      content: params.content,
      tags: params.tags ?? existing.tags,
      approvalState: 'DRAFT',
      version: existing.version + 1,
      sourceRef: params.sourceRef ?? existing.sourceRef,
      jurisdiction: existing.jurisdiction,
      ...(params.validFrom !== undefined ? { validFrom: params.validFrom } : {}),
      ...(params.validUntil !== undefined ? { validUntil: params.validUntil } : {}),
    },
  });
  return { kind: 'CREATED', item };
}

export interface ListUsableKnowledgeItemsParams {
  type?: KnowledgeType;
  now?: Date;
}

/**
 * The only sanctioned read path for externally-usable knowledge (message
 * drafting, reply composition, etc.). The DB query filters to APPROVED, but
 * every row is re-checked through isKnowledgeItemUsable before being
 * returned — a validity window that lapsed between query time and use, or
 * any drift between the DB filter and the domain rule, can never leak a
 * stale item to a caller.
 */
export async function listUsableKnowledgeItems(
  prisma: PrismaClient,
  params: ListUsableKnowledgeItemsParams = {},
): Promise<KnowledgeItem[]> {
  const now = params.now ?? new Date();
  const rows = await prisma.knowledgeItem.findMany({
    where: {
      approvalState: 'APPROVED',
      ...(params.type !== undefined ? { type: params.type } : {}),
    },
  });
  return rows.filter((row) => isKnowledgeItemUsable(row, now));
}
