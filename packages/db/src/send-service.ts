import type { PrismaClient } from '@prisma/client';
import { completeIdempotencyKey, computeRequestHash, reserveIdempotencyKey } from './idempotency-service';

export interface EmailSender {
  send(params: { to: string; subject: string; body: string }): Promise<{ providerMessageId: string }>;
}

export interface SendEmailIdempotentParams {
  idempotencyKey: string;
  to: string;
  subject: string;
  body: string;
}

export type SendEmailIdempotentOutcome =
  | { kind: 'SENT'; providerMessageId: string }
  | { kind: 'DUPLICATE'; providerMessageId: string | null }
  | { kind: 'CONFLICT' };

/**
 * The idempotency key is reserved BEFORE the provider is ever called, and
 * completed only after a successful send. A retry with the same key and the
 * same request payload short-circuits to DUPLICATE without a second provider
 * call (BP-021: "retry does not duplicate provider send"); the same key with
 * a different payload is a CONFLICT, not silently accepted.
 */
export async function sendEmailIdempotent(
  prisma: PrismaClient,
  sender: EmailSender,
  params: SendEmailIdempotentParams,
): Promise<SendEmailIdempotentOutcome> {
  const requestHash = computeRequestHash({ to: params.to, subject: params.subject, body: params.body });
  const reservation = await reserveIdempotencyKey(prisma, {
    key: params.idempotencyKey,
    action: 'send_email',
    requestHash,
  });

  if (reservation.kind === 'CONFLICT') return { kind: 'CONFLICT' };

  if (reservation.kind === 'DUPLICATE') {
    const response = reservation.responseJson as { providerMessageId?: string } | null;
    return { kind: 'DUPLICATE', providerMessageId: response?.providerMessageId ?? null };
  }

  const result = await sender.send({ to: params.to, subject: params.subject, body: params.body });
  await completeIdempotencyKey(prisma, params.idempotencyKey, { providerMessageId: result.providerMessageId });
  return { kind: 'SENT', providerMessageId: result.providerMessageId };
}
