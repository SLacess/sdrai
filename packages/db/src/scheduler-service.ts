import type { PrismaClient, SequenceEnrollment } from '@prisma/client';

export interface FindDueEnrollmentsParams {
  now?: Date;
  limit?: number;
}

/**
 * The WHERE clause is the entire guarantee here: only state='ACTIVE' rows
 * are ever candidates. A PAUSED (inbound reply / manual pause) or
 * SUPPRESSED/CANCELLED/COMPLETED enrollment is structurally invisible to
 * the scheduler — there is no code path where BP-023 can pick one up.
 */
export async function findDueEnrollments(
  prisma: PrismaClient,
  params: FindDueEnrollmentsParams = {},
): Promise<SequenceEnrollment[]> {
  const now = params.now ?? new Date();
  return prisma.sequenceEnrollment.findMany({
    where: { state: 'ACTIVE', nextActionAt: { lte: now } },
    orderBy: { nextActionAt: 'asc' },
    take: params.limit ?? 50,
  });
}

export interface ClaimDueEnrollmentParams {
  enrollmentId: string;
  contactId: string;
  expectedVersion: number;
  nextActionAt: Date | null;
  frequencyCapPerContactPerDay?: number;
}

export type ClaimDueEnrollmentOutcome = 'CLAIMED' | 'CONFLICT' | 'CAP_EXCEEDED';

/**
 * CAS-guarded claim: if the enrollment's version has moved since the caller
 * read it (e.g. BP-025 paused it because a reply just arrived), this
 * updates zero rows and returns CONFLICT instead of proceeding — the same
 * race-safety mechanism as pauseEnrollment/handleInboundMessage, applied
 * from the sending side.
 */
export async function claimDueEnrollment(
  prisma: PrismaClient,
  params: ClaimDueEnrollmentParams,
): Promise<ClaimDueEnrollmentOutcome> {
  if (params.frequencyCapPerContactPerDay !== undefined) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await prisma.touchpoint.count({
      where: { contactId: params.contactId, direction: 'OUTBOUND', sentAt: { gte: since } },
    });
    if (sentToday >= params.frequencyCapPerContactPerDay) return 'CAP_EXCEEDED';
  }

  const updated = await prisma.sequenceEnrollment.updateMany({
    where: { id: params.enrollmentId, state: 'ACTIVE', version: params.expectedVersion },
    data: {
      currentStep: { increment: 1 },
      nextActionAt: params.nextActionAt,
      version: { increment: 1 },
    },
  });

  return updated.count > 0 ? 'CLAIMED' : 'CONFLICT';
}
