import { Prisma, type ActorType, type PrismaClient, type SequenceEnrollment } from '@prisma/client';

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export type EnrollContactOutcome =
  | { kind: 'ENROLLED'; enrollment: SequenceEnrollment }
  | { kind: 'CONFLICT'; activeEnrollmentId: string };

/**
 * Enforces "one active enrollment per contact" (config/defaults.yaml
 * sequence.oneActivePerContact). The findFirst check is the fast path; a
 * partial unique index on (contactId) WHERE state='ACTIVE' (see the
 * 20260811010000 migration) is the actual race-safe guarantee — the catch
 * block below turns that DB-level rejection into the same CONFLICT outcome.
 */
export async function enrollContact(
  prisma: PrismaClient,
  params: { campaignId: string; contactId: string },
): Promise<EnrollContactOutcome> {
  const existingActive = await prisma.sequenceEnrollment.findFirst({
    where: { contactId: params.contactId, state: 'ACTIVE' },
  });
  if (existingActive) return { kind: 'CONFLICT', activeEnrollmentId: existingActive.id };

  try {
    const enrollment = await prisma.sequenceEnrollment.create({
      data: { campaignId: params.campaignId, contactId: params.contactId, state: 'ACTIVE' },
    });
    return { kind: 'ENROLLED', enrollment };
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    const raced = await prisma.sequenceEnrollment.findFirst({
      where: { contactId: params.contactId, state: 'ACTIVE' },
    });
    if (raced) return { kind: 'CONFLICT', activeEnrollmentId: raced.id };
    throw error;
  }
}

export type EnrollmentTransitionOutcome =
  | { kind: 'UPDATED'; enrollment: SequenceEnrollment }
  | { kind: 'CONFLICT' }
  | { kind: 'NOT_FOUND' };

interface AuditedTransitionParams {
  enrollmentId: string;
  reason: string;
  actorType: ActorType;
  actorId?: string;
}

/**
 * Pauses/resumes are optimistic-concurrency-guarded (SequenceEnrollment.version)
 * and audited via a LeadStateEvent against the contact, atomically with the
 * enrollment update, so "why was this contact paused" is always answerable.
 */
async function transitionEnrollmentState(
  prisma: PrismaClient,
  params: AuditedTransitionParams,
  fromState: 'ACTIVE' | 'PAUSED',
  toState: 'ACTIVE' | 'PAUSED',
  extraData: Prisma.SequenceEnrollmentUpdateManyMutationInput,
): Promise<EnrollmentTransitionOutcome> {
  const existing = await prisma.sequenceEnrollment.findUnique({ where: { id: params.enrollmentId } });
  if (!existing) return { kind: 'NOT_FOUND' };
  if (existing.state !== fromState) return { kind: 'CONFLICT' };

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.sequenceEnrollment.updateMany({
        where: { id: params.enrollmentId, version: existing.version },
        data: { ...extraData, version: { increment: 1 } },
      });
      if (updated.count === 0) return { kind: 'CONFLICT' as const };

      await tx.leadStateEvent.create({
        data: {
          entityType: 'CONTACT',
          entityId: existing.contactId,
          fromState,
          toState,
          reason: params.reason,
          actorType: params.actorType,
          ...(params.actorId !== undefined ? { actorId: params.actorId } : {}),
          contactId: existing.contactId,
        },
      });

      const enrollment = await tx.sequenceEnrollment.findUniqueOrThrow({ where: { id: params.enrollmentId } });
      return { kind: 'UPDATED' as const, enrollment };
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { kind: 'CONFLICT' };
    throw error;
  }
}

export async function pauseEnrollment(
  prisma: PrismaClient,
  params: AuditedTransitionParams,
): Promise<EnrollmentTransitionOutcome> {
  return transitionEnrollmentState(prisma, params, 'ACTIVE', 'PAUSED', {
    state: 'PAUSED',
    pausedAt: new Date(),
    pauseReason: params.reason,
  });
}

export async function resumeEnrollment(
  prisma: PrismaClient,
  params: AuditedTransitionParams,
): Promise<EnrollmentTransitionOutcome> {
  return transitionEnrollmentState(prisma, params, 'PAUSED', 'ACTIVE', {
    state: 'ACTIVE',
    pausedAt: null,
    pauseReason: null,
  });
}
