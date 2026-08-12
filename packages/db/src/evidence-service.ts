import type { Evidence, Prisma, PrismaClient } from '@prisma/client';
import { checkRequiredEvidence, type EvidenceCheckResult } from '@sinal/domain';

export async function createEvidence(
  prisma: PrismaClient,
  data: Prisma.EvidenceCreateInput,
): Promise<Evidence> {
  return prisma.evidence.create({ data });
}

export async function expireEvidence(prisma: PrismaClient, id: string, at: Date = new Date()): Promise<Evidence> {
  return prisma.evidence.update({ where: { id }, data: { expiresAt: at } });
}

export async function getEvidenceForEntity(
  prisma: PrismaClient,
  entityType: Evidence['entityType'],
  entityId: string,
): Promise<Evidence[]> {
  return prisma.evidence.findMany({ where: { entityType, entityId }, orderBy: { capturedAt: 'desc' } });
}

/**
 * Fetches the requested evidence ids fresh from the database and re-checks
 * expiry at call time, so a claim approved earlier cannot ride on evidence
 * that has since expired (CLAUDE.md: confidence/evidence checks happen
 * immediately before external use, not only at draft time).
 */
export async function verifyRequiredEvidence(
  prisma: PrismaClient,
  requiredIds: readonly string[],
  now: Date = new Date(),
): Promise<EvidenceCheckResult> {
  if (requiredIds.length === 0) return { allPresent: true, missingIds: [], expiredIds: [] };
  const rows = await prisma.evidence.findMany({ where: { id: { in: [...requiredIds] } } });
  return checkRequiredEvidence(requiredIds, rows, now);
}
