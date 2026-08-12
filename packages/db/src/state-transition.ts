import type { ActorType, Prisma, PrismaClient } from '@prisma/client';
import {
  assertAccountTransition,
  assertLeadTransition,
  assertOpportunityTransition,
  type AccountState,
  type LeadState,
  type OpportunityState,
} from '@sinal/domain';

export type TransitionEntity = 'ACCOUNT' | 'CONTACT' | 'OPPORTUNITY';

export interface TransitionParams {
  entity: TransitionEntity;
  id: string;
  from: string;
  to: string;
  reason: string;
  actorType: ActorType;
  actorId?: string;
  metadata?: Prisma.InputJsonValue;
}

export class OptimisticConcurrencyError extends Error {
  constructor(
    public entity: TransitionEntity,
    public id: string,
  ) {
    super(`Concurrent modification detected for ${entity} ${id}: expected "from" state no longer matches`);
  }
}

function assertDomainTransition(entity: TransitionEntity, from: string, to: string): void {
  if (entity === 'ACCOUNT') assertAccountTransition(from as AccountState, to as AccountState);
  else if (entity === 'CONTACT') assertLeadTransition(from as LeadState, to as LeadState);
  else assertOpportunityTransition(from as OpportunityState, to as OpportunityState);
}

async function casUpdate(
  tx: Prisma.TransactionClient,
  params: TransitionParams,
): Promise<{ count: number }> {
  switch (params.entity) {
    case 'ACCOUNT':
      return tx.account.updateMany({
        where: { id: params.id, status: params.from as never },
        data: { status: params.to as never },
      });
    case 'CONTACT':
      return tx.contact.updateMany({
        where: { id: params.id, leadState: params.from as never },
        data: { leadState: params.to as never },
      });
    case 'OPPORTUNITY':
      return tx.opportunity.updateMany({
        where: { id: params.id, stage: params.from as never },
        data: { stage: params.to as never },
      });
  }
}

/**
 * Validates the transition against the domain state machine, then applies it
 * atomically: a compare-and-swap update (WHERE id AND currentState = from)
 * guards against concurrent writers, and the append-only LeadStateEvent is
 * written in the same transaction so state and audit trail never diverge.
 */
export async function transitionEntityState(prisma: PrismaClient, params: TransitionParams): Promise<void> {
  assertDomainTransition(params.entity, params.from, params.to);

  await prisma.$transaction(async (tx) => {
    const updated = await casUpdate(tx, params);
    if (updated.count === 0) throw new OptimisticConcurrencyError(params.entity, params.id);

    await tx.leadStateEvent.create({
      data: {
        entityType: params.entity,
        entityId: params.id,
        fromState: params.from,
        toState: params.to,
        reason: params.reason,
        actorType: params.actorType,
        ...(params.actorId !== undefined ? { actorId: params.actorId } : {}),
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        ...(params.entity === 'ACCOUNT' ? { accountId: params.id } : {}),
        ...(params.entity === 'CONTACT' ? { contactId: params.id } : {}),
      },
    });
  });
}
