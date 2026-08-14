import type { PrismaClient } from '@prisma/client';
import type { AccountScoreFactors } from '@sinal/domain';
import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_SCORE_MODEL_VERSION, recordAccountScore } from './scoring-service';

function createMockPrisma() {
  const score = { create: vi.fn() };
  const account = { update: vi.fn(), findUnique: vi.fn() };
  const policyConfig = { findUnique: vi.fn() };
  const txAccount = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const leadStateEvent = { create: vi.fn() };
  const $transaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({ account: txAccount, leadStateEvent }),
  );
  return {
    prisma: { score, account, policyConfig, $transaction } as unknown as PrismaClient,
    score,
    account,
    policyConfig,
    txAccount,
    leadStateEvent,
  };
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

  it('promotes a RESEARCHING account to QUALIFIED_ACCOUNT once the score meets the SQL minimum threshold', async () => {
    const { prisma, account, txAccount, leadStateEvent } = createMockPrisma();
    account.findUnique.mockResolvedValue({ status: 'RESEARCHING' });

    // FACTORS totals to 71.75, above the default sqlMinimumAccountScore of 70.
    await recordAccountScore(prisma, 'acc-1', FACTORS);

    expect(txAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'acc-1', status: 'RESEARCHING' },
      data: { status: 'QUALIFIED_ACCOUNT' },
    });
    expect(leadStateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: 'ACCOUNT', entityId: 'acc-1', fromState: 'RESEARCHING', toState: 'QUALIFIED_ACCOUNT' }),
      }),
    );
  });

  it('does not promote an account that is not currently RESEARCHING, even with a qualifying score', async () => {
    const { prisma, account, txAccount } = createMockPrisma();
    account.findUnique.mockResolvedValue({ status: 'DISCOVERED' });

    await recordAccountScore(prisma, 'acc-1', FACTORS);

    expect(txAccount.updateMany).not.toHaveBeenCalled();
  });

  it('does not attempt promotion when the score is below the SQL minimum threshold', async () => {
    const { prisma, account } = createMockPrisma();
    const lowFactors: AccountScoreFactors = { ...FACTORS, companyFit: 0, digitalExposure: 0, accessibilityOpportunity: 0, inclusionEsgSignal: 0, commercialTriggerTiming: 0, buyingCommitteeQuality: 0, engagement: 0 };

    await recordAccountScore(prisma, 'acc-1', lowFactors);

    expect(account.findUnique).not.toHaveBeenCalled();
  });
});
