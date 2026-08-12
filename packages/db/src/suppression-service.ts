import type { ChannelType, Prisma, PrismaClient, Suppression, SuppressionScope } from '@prisma/client';

export interface CreateSuppressionInput {
  scope: SuppressionScope;
  channel?: ChannelType;
  address?: string;
  domain?: string;
  reason: string;
  source: string;
  accountId?: string;
  contactId?: string;
  expiresAt?: Date;
}

export interface SuppressionCheckParams {
  contactId?: string;
  accountId?: string;
  address?: string;
  domain?: string;
}

/**
 * A suppression with a past expiresAt no longer blocks anything — it is
 * never deleted (CLAUDE.md: Suppression/Audit are not erased by routine
 * jobs), just excluded from the active check.
 */
export async function isSuppressed(
  prisma: PrismaClient,
  params: SuppressionCheckParams,
  now: Date = new Date(),
): Promise<boolean> {
  const scopeConditions: Prisma.SuppressionWhereInput[] = [];
  if (params.contactId) scopeConditions.push({ scope: 'CONTACT', contactId: params.contactId });
  if (params.accountId) scopeConditions.push({ scope: 'ACCOUNT', accountId: params.accountId });
  if (params.address) scopeConditions.push({ scope: 'ADDRESS', address: params.address });
  if (params.domain) scopeConditions.push({ scope: 'DOMAIN', domain: params.domain });
  if (scopeConditions.length === 0) return false;

  const match = await prisma.suppression.findFirst({
    where: {
      OR: scopeConditions,
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
  });
  return match !== null;
}

export interface SuppressContactResult {
  suppression: Suppression;
  cancelledEnrollments: number;
}

/**
 * CLAUDE.md rule 11: opt-out creates a Suppression and ends every applicable
 * cadence. Both happen in one transaction — a suppression can never exist
 * without its enrollments having already been moved out of ACTIVE/PAUSED.
 */
export async function suppressContact(
  prisma: PrismaClient,
  input: CreateSuppressionInput,
): Promise<SuppressContactResult> {
  return prisma.$transaction(async (tx) => {
    const suppression = await tx.suppression.create({
      data: {
        scope: input.scope,
        reason: input.reason,
        source: input.source,
        ...(input.channel !== undefined ? { channel: input.channel } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      },
    });

    let cancelledEnrollments = 0;
    if (input.contactId) {
      const result = await tx.sequenceEnrollment.updateMany({
        where: { contactId: input.contactId, state: { in: ['ACTIVE', 'PAUSED'] } },
        data: { state: 'SUPPRESSED', pausedAt: new Date(), pauseReason: input.reason },
      });
      cancelledEnrollments = result.count;
    }

    return { suppression, cancelledEnrollments };
  });
}
