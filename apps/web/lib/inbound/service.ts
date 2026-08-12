import { createHash } from 'node:crypto';
import { handleInboundMessage, recordIntegrationEvent, type PrismaClient } from '@sinal/db';
import { verifyWebhookSignature } from '@/lib/webhooks/verify-signature';
import { InboundWebhookSchema } from './validation';

export interface ProcessInboundWebhookParams {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
}

export type ProcessInboundWebhookResult =
  | { kind: 'UNAUTHORIZED'; reason: string }
  | { kind: 'INVALID'; message: string }
  | { kind: 'DUPLICATE' }
  | { kind: 'UNMATCHED_CONTACT' }
  | { kind: 'ACCEPTED'; inboundMessageId: string };

/**
 * Signature -> replay-dedupe -> pause-first persistence, in that order. A
 * request that fails signature verification never touches IntegrationEvent
 * or the pause/persist transaction at all.
 */
export async function processInboundWebhook(
  prisma: PrismaClient,
  params: ProcessInboundWebhookParams,
): Promise<ProcessInboundWebhookResult> {
  const verification = verifyWebhookSignature({
    payload: params.rawBody,
    signature: params.signature,
    timestamp: params.timestamp,
    secret: params.secret,
  });
  if (!verification.valid) return { kind: 'UNAUTHORIZED', reason: verification.reason };

  let body: unknown;
  try {
    body = JSON.parse(params.rawBody);
  } catch {
    return { kind: 'INVALID', message: 'Request body is not valid JSON' };
  }

  const parsed = InboundWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return { kind: 'INVALID', message: parsed.error.issues.map((issue) => issue.message).join('; ') };
  }

  const payloadHash = createHash('sha256').update(params.rawBody).digest('hex');
  const eventOutcome = await recordIntegrationEvent(prisma, {
    provider: parsed.data.provider,
    externalId: parsed.data.eventId,
    type: 'inbound_message',
    payloadHash,
  });
  if (eventOutcome === 'DUPLICATE') return { kind: 'DUPLICATE' };

  const contactChannel = await prisma.contactChannel.findFirst({
    where: { channel: parsed.data.channel, address: parsed.data.address },
  });
  if (!contactChannel) return { kind: 'UNMATCHED_CONTACT' };

  const result = await handleInboundMessage(prisma, {
    contactId: contactChannel.contactId,
    channel: parsed.data.channel,
    ...(parsed.data.providerThreadId !== undefined ? { providerId: parsed.data.providerThreadId } : {}),
    rawContent: parsed.data.rawContent,
    receivedAt: new Date(parsed.data.receivedAt),
  });

  return { kind: 'ACCEPTED', inboundMessageId: result.inboundMessage.id };
}
