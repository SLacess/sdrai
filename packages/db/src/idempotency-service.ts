import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

export function computeRequestHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export type IdempotencyOutcome =
  | { kind: 'RESERVED' }
  | { kind: 'DUPLICATE'; responseJson: unknown }
  | { kind: 'CONFLICT' };

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Reserves an idempotency key before any side effect (CLAUDE.md rule 12: no
 * send without an idempotency key + a fresh policy check immediately before
 * the provider call). Same key + same request hash while in flight or
 * already completed -> DUPLICATE (caller should skip re-executing the side
 * effect and, if completed, may reuse the stored response). Same key with a
 * different request hash -> CONFLICT (reject; this is a different request
 * reusing someone else's idempotency key).
 */
export async function reserveIdempotencyKey(
  prisma: PrismaClient,
  params: { key: string; action: string; requestHash: string; ttlMs?: number },
): Promise<IdempotencyOutcome> {
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: params.key } });
  if (existing) return resolveExisting(existing, params.requestHash);

  try {
    await prisma.idempotencyRecord.create({
      data: {
        key: params.key,
        action: params.action,
        requestHash: params.requestHash,
        status: 'IN_PROGRESS',
        ...(params.ttlMs !== undefined ? { expiresAt: new Date(Date.now() + params.ttlMs) } : {}),
      },
    });
    return { kind: 'RESERVED' };
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    // Lost a race with a concurrent reservation of the same key; re-read and
    // classify it the same way we would have if we'd seen it up front.
    const raced = await prisma.idempotencyRecord.findUnique({ where: { key: params.key } });
    if (!raced) throw error;
    return resolveExisting(raced, params.requestHash);
  }
}

function resolveExisting(
  record: { requestHash: string; status: string; responseJson: unknown },
  requestHash: string,
): IdempotencyOutcome {
  if (record.requestHash !== requestHash) return { kind: 'CONFLICT' };
  return { kind: 'DUPLICATE', responseJson: record.responseJson ?? null };
}

export async function completeIdempotencyKey(
  prisma: PrismaClient,
  key: string,
  responseJson: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.idempotencyRecord.update({ where: { key }, data: { status: 'COMPLETED', responseJson } });
}
