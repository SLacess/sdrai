import type { ChannelType, Contact, PrismaClient } from '@prisma/client';
import { normalizeName } from '@sinal/domain';

export interface BuyingCommitteeChannelInput {
  type: ChannelType;
  address: string;
  verified: boolean;
}

export interface BuyingCommitteeContactInput {
  name: string;
  title?: string;
  department?: string;
  role: string;
  confidence: number;
  channel: BuyingCommitteeChannelInput;
}

export interface UpsertBuyingCommitteeParams {
  accountId: string;
  contacts: readonly BuyingCommitteeContactInput[];
}

export interface UpsertBuyingCommitteeResult {
  contactIds: string[];
}

/**
 * A channel the agent could not verify is persisted as UNVERIFIED — never
 * VERIFIED, never with verifiedAt/verificationSource — regardless of how
 * confident the agent claims to be. This is what makes "unverified guessed
 * channels rejected" concrete: the Policy Engine's verifiedChannel check
 * (packages/policies) blocks any outbound send against an UNVERIFIED
 * channel until a real verification step upgrades it.
 */
export async function upsertBuyingCommittee(
  prisma: PrismaClient,
  params: UpsertBuyingCommitteeParams,
): Promise<UpsertBuyingCommitteeResult> {
  const contactIds: string[] = [];

  for (const input of params.contacts) {
    const existingChannel = await prisma.contactChannel.findUnique({
      where: { channel_address: { channel: input.channel.type, address: input.channel.address } },
    });

    let contact: Contact;
    if (existingChannel) {
      contact = await prisma.contact.update({
        where: { id: existingChannel.contactId },
        data: {
          name: input.name,
          normalizedName: normalizeName(input.name),
          roleInBuyingCommittee: input.role,
          confidence: input.confidence,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.department !== undefined ? { department: input.department } : {}),
        },
      });
      await prisma.contactChannel.update({
        where: { id: existingChannel.id },
        data: channelUpdateData(input.channel.verified),
      });
    } else {
      contact = await prisma.contact.create({
        data: {
          accountId: params.accountId,
          name: input.name,
          normalizedName: normalizeName(input.name),
          roleInBuyingCommittee: input.role,
          confidence: input.confidence,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.department !== undefined ? { department: input.department } : {}),
        },
      });
      await prisma.contactChannel.create({
        data: {
          contactId: contact.id,
          channel: input.channel.type,
          address: input.channel.address,
          ...channelUpdateData(input.channel.verified),
        },
      });
    }

    contactIds.push(contact.id);
  }

  return { contactIds };
}

function channelUpdateData(verified: boolean) {
  if (!verified) return { status: 'UNVERIFIED' as const };
  return { status: 'VERIFIED' as const, verifiedAt: new Date(), verificationSource: 'agent' };
}
