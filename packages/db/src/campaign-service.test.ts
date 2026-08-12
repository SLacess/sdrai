import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createCampaign } from './campaign-service';

function createMockPrisma() {
  const campaign = { create: vi.fn() };
  return { prisma: { campaign } as unknown as PrismaClient, campaign };
}

describe('createCampaign', () => {
  it('persists the required fields and defaults language when omitted', async () => {
    const { prisma, campaign } = createMockPrisma();
    campaign.create.mockResolvedValue({ id: 'campaign-1' });

    await createCampaign(prisma, {
      name: 'Q3 Accessibility Push',
      icp: { sector: 'Retail' },
      offer: { product: 'Accessibility Audit' },
      channels: ['EMAIL', 'LINKEDIN'],
      guardrails: { maxPerDay: 50 },
      frequencyCaps: { perContactPerWeek: 2 },
    });

    expect(campaign.create).toHaveBeenCalledWith({
      data: {
        name: 'Q3 Accessibility Push',
        icp: { sector: 'Retail' },
        offer: { product: 'Accessibility Audit' },
        channels: ['EMAIL', 'LINKEDIN'],
        guardrails: { maxPerDay: 50 },
        frequencyCaps: { perContactPerWeek: 2 },
      },
    });
  });

  it('includes an explicit language when provided', async () => {
    const { prisma, campaign } = createMockPrisma();
    campaign.create.mockResolvedValue({ id: 'campaign-1' });

    await createCampaign(prisma, {
      name: 'Campaign ES',
      icp: {},
      offer: {},
      channels: ['EMAIL'],
      guardrails: {},
      frequencyCaps: {},
      language: 'es',
    });

    expect(campaign.create).toHaveBeenCalledWith({ data: expect.objectContaining({ language: 'es' }) });
  });
});
