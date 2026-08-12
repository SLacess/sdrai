import type { PrismaClient } from '@sinal/db';
import { describe, expect, it, vi } from 'vitest';
import { loadPolicyOverview } from './service';

function createMockPrisma() {
  const policyConfig = { findUnique: vi.fn().mockResolvedValue(null) };
  const policyConfigAudit = { findMany: vi.fn().mockResolvedValue([]) };
  return { prisma: { policyConfig, policyConfigAudit } as unknown as PrismaClient, policyConfig, policyConfigAudit };
}

describe('loadPolicyOverview', () => {
  it('returns one entry per known policy key, each with its own audit trail', async () => {
    const { prisma } = createMockPrisma();

    const result = await loadPolicyOverview(prisma);

    expect(result).toHaveLength(3);
    expect(result.every((item) => Array.isArray(item.recentAudit))).toBe(true);
  });

  it('attaches the matching audit trail to its own policy key, not a shared list', async () => {
    const { prisma, policyConfigAudit } = createMockPrisma();
    policyConfigAudit.findMany.mockImplementation((args: { where: { policyKey: string } }) =>
      Promise.resolve(args.where.policyKey === 'forbiddenClaims' ? [{ id: 'audit-1', policyKey: 'forbiddenClaims' }] : []),
    );

    const result = await loadPolicyOverview(prisma);

    const forbiddenClaims = result.find((item) => item.key === 'forbiddenClaims');
    const scoreThresholds = result.find((item) => item.key === 'score.thresholds');
    expect(forbiddenClaims?.recentAudit).toEqual([{ id: 'audit-1', policyKey: 'forbiddenClaims' }]);
    expect(scoreThresholds?.recentAudit).toEqual([]);
  });
});
