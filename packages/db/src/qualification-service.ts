import type { LeadState, Prisma, PrismaClient } from '@prisma/client';
import { determineIsSql, type QualificationCriteria } from '@sinal/domain';
import { transitionEntityState } from './state-transition';

export interface PersistQualificationParams {
  contactId: string;
  accountId: string;
  currentLeadState: LeadState;
  qualification: QualificationCriteria & { timing: string | null; handoffReason: string | null };
  correlationId: string;
}

export interface PersistQualificationResult {
  isSql: boolean;
  unmetCriteria: string[];
  opportunityId: string | null;
  requiresHandoff: boolean;
}

/**
 * The agent's own `isSql` field is never trusted here — determineIsSql
 * recomputes it from the structured criteria. Only when OUR determination
 * says SQL do we create an Opportunity and transition the contact to SQL.
 * A handoff (meeting/demo/pricing request) can still be required even when
 * the deterministic criteria aren't fully met yet — e.g. a prospect who
 * explicitly asks for a call before stating a concrete need.
 */
export async function persistQualification(
  prisma: PrismaClient,
  params: PersistQualificationParams,
): Promise<PersistQualificationResult> {
  const { isSql, unmetCriteria } = determineIsSql(params.qualification);
  const requiresHandoff = isSql || params.qualification.handoffReason !== null;

  let opportunityId: string | null = null;

  if (isSql) {
    const opportunity = await prisma.opportunity.create({
      data: {
        accountId: params.accountId,
        stage: 'QUALIFIED_OPPORTUNITY',
        need: params.qualification.need,
        scope: params.qualification.scope as unknown as Prisma.InputJsonValue,
        timing: params.qualification.timing,
        contacts: { create: [{ contactId: params.contactId }] },
      },
    });
    opportunityId = opportunity.id;

    if (params.currentLeadState !== 'SQL') {
      await transitionEntityState(prisma, {
        entity: 'CONTACT',
        id: params.contactId,
        from: params.currentLeadState,
        to: 'SQL',
        reason: 'Qualification criteria met',
        actorType: 'AGENT',
      });
    }
  }

  return { isSql, unmetCriteria, opportunityId, requiresHandoff };
}
