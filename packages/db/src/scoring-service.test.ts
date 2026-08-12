import type { PrismaClient } from '@prisma/client';
import type { AccountScoreFactors } from '@sinal/domain';
import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_SCORE_MODEL_VERSION, recordAccountScore } from './scoring-service';

function createMockPrisma() {
  const score = { create: vi.fn() };
  const account = { update: vi.fn() };
  return { prisma: { score, account } as unknown as PrismaClient, score, account };
}

const FACTORS: AccountScoreFactors = {
  companyFit: 90,
  digitalExposure: 70,
  accessibilityOpportunity: 85,
  inclusionEsgSignal: 50,
  commercialTriggerTiming: 60,
  buyingCommitteeQuality: 40,
  engagement: 30,
};

describe('recordAccountScore', () => {
  it('persists total, factors, and a stable model version, and updates priorityBand', async () => {
    const { prisma, score, account } = createMockPrisma();
    score.create.mockResolvedValue({ id: 'score-1', total: 71.75 });

    const result = await recordAccountScore(prisma, 'acc-1', FACTORS);

    expect(score.create).toHaveBeenCalledWith({
      data: {
        scoreType: 'ACCOUNT_PRIORITY',
        total: 71.75,
        factorsJson: FACTORS,
        modelVersion: ACCOUNT_SCORE_MODEL_VERSION,
        accountId: 'acc-1',
      },
    });
    expect(account.update).toHaveBeenCalledWith({ where: { id: 'acc-1' }, data: { priorityBand: 'B' } });
    expect(result).toEqual({ id: 'score-1', total: 71.75 });
  });

  it('maps a below-threshold total to the BELOW_THRESHOLD band', async () => {
    const { prisma, account } = createMockPrisma();
    const lowFactors: AccountScoreFactors = { ...FACTORS, companyFit: 0, digitalExposure: 0, accessibilityOpportunity: 0, inclusionEsgSignal: 0, commercialTriggerTiming: 0, buyingCommitteeQuality: 0, engagement: 0 };

    await recordAccountScore(prisma, 'acc-1', lowFactors);

    expect(account.update).toHaveBeenCalledWith({ where: { id: 'acc-1' }, data: { priorityBand: 'BELOW_THRESHOLD' } });
  });

  it('rejects an out-of-range factor before touching the database', async () => {
    const { prisma, score, account } = createMockPrisma();
    await expect(recordAccountScore(prisma, 'acc-1', { ...FACTORS, engagement: 150 })).rejects.toThrow(
      'engagement must be 0..100',
    );
    expect(score.create).not.toHaveBeenCalled();
    expect(account.update).not.toHaveBeenCalled();
  });
});
