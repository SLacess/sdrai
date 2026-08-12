import { Prisma, type PrismaClient } from '@prisma/client';

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export interface RecordIntegrationEventInput {
  provider: string;
  externalId: string;
  type: string;
  payloadHash: string;
  payload?: Prisma.InputJsonValue;
}

export type RecordIntegrationEventOutcome = 'NEW' | 'DUPLICATE';

/**
 * IntegrationEvent's @@unique([provider, externalId]) is the actual replay
 * guard: a webhook redelivering the same event id can only ever insert once.
 * The route handler should return 409/noop on DUPLICATE without reprocessing.
 */
export async function recordIntegrationEvent(
  prisma: PrismaClient,
  input: RecordIntegrationEventInput,
): Promise<RecordIntegrationEventOutcome> {
  try {
    await prisma.integrationEvent.create({
      data: {
        provider: input.provider,
        externalId: input.externalId,
        type: input.type,
        payloadHash: input.payloadHash,
        status: 'RECEIVED',
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
      },
    });
    return 'NEW';
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return 'DUPLICATE';
    throw error;
  }
}
