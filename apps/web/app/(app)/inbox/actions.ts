'use server';

import { createReplyDraft, isSuppressed, prisma, type IntentType } from '@sinal/db';
import { revalidatePath } from 'next/cache';

/**
 * Deterministic per-intent opener — there is no reply-writer LLM pipeline
 * wired up yet (no AI_PROVIDER_PRIMARY configured), so this stands in for
 * one the same way MockLeadProvider stands in for a real discovery source:
 * enough to produce a real PENDING_APPROVAL draft a human can edit and
 * approve in the Approval Center, never a straight-to-send message.
 */
function replyTemplateFor(intent: IntentType): string {
  switch (intent) {
    case 'REQUEST_MEETING':
      return 'Obrigado pelo retorno! Podemos marcar uma call essa semana — qual horário funciona melhor para você?';
    case 'REQUEST_DEMO':
      return 'Ótimo saber do seu interesse! Vou providenciar uma demonstração — qual seria um bom horário para você?';
    case 'REQUEST_INFO':
      return 'Claro, vou te enviar mais detalhes em seguida. Fico à disposição para qualquer dúvida.';
    case 'OBJECTION':
      return 'Entendo a preocupação — posso esclarecer melhor esse ponto, você teria alguns minutos para conversarmos?';
    default:
      return 'Obrigado pelo retorno! Vou dar seguimento em breve.';
  }
}

export async function draftReplyAction(formData: FormData): Promise<void> {
  const inboundMessageId = String(formData.get('inboundMessageId') ?? '');
  if (!inboundMessageId) return;

  const inbound = await prisma.inboundMessage.findUniqueOrThrow({ where: { id: inboundMessageId } });
  const contactId = inbound.contactId;

  const [hasSuppression, channel, latestInbound] = await Promise.all([
    isSuppressed(prisma, { contactId }),
    prisma.contactChannel.findFirst({ where: { contactId, channel: inbound.channel } }),
    prisma.inboundMessage.findFirst({ where: { contactId }, orderBy: { receivedAt: 'desc' } }),
  ]);

  await createReplyDraft(prisma, {
    contactId,
    angle: 'Reply',
    body: replyTemplateFor(inbound.intent),
    language: 'pt-BR',
    promptVersion: 'reply-template-v1',
    evidenceIds: [],
    knowledgeItemIds: [],
    claims: [],
    confidence: 0.8,
    supervisorVerdict: 'PASS',
    unsupportedClaims: [],
    supervisorReasons: [],
    accountVip: false,
    hasSuppression,
    // Frequency caps bound cold-outreach cadence, not a reply to a contact
    // who just wrote in — replying isn't a new touch attempt.
    frequencyCapOk: true,
    verifiedChannel: channel?.status === 'VERIFIED',
    // Block if a newer inbound on this contact hasn't been classified yet —
    // CLAUDE.md rule 10: any inbound pauses outbound until classified.
    inboundPending: latestInbound !== null && latestInbound.id !== inbound.id && latestInbound.intent === 'UNKNOWN',
  });

  revalidatePath('/inbox');
}
