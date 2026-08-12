import type { Campaign, ChannelType, Prisma, PrismaClient } from '@prisma/client';

export interface CreateCampaignInput {
  name: string;
  icp: Prisma.InputJsonValue;
  offer: Prisma.InputJsonValue;
  channels: ChannelType[];
  guardrails: Prisma.InputJsonValue;
  frequencyCaps: Prisma.InputJsonValue;
  language?: string;
}

export async function createCampaign(prisma: PrismaClient, input: CreateCampaignInput): Promise<Campaign> {
  return prisma.campaign.create({
    data: {
      name: input.name,
      icp: input.icp,
      offer: input.offer,
      channels: input.channels,
      guardrails: input.guardrails,
      frequencyCaps: input.frequencyCaps,
      ...(input.language !== undefined ? { language: input.language } : {}),
    },
  });
}
