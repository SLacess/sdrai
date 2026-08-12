import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  getPolicyConfig,
  listPolicyConfigAudit,
  listPolicyConfigs,
  POLICY_CONFIG_KEYS,
  updatePolicyConfig,
} from './policy-config-service';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
}

function createMockPrisma() {
  const policyConfig = {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const policyConfigAudit = { create: vi.fn(), findMany: vi.fn() };
  const tx = { policyConfig, policyConfigAudit };
  const prisma = {
    policyConfig,
    policyConfigAudit,
    $transaction: vi.fn(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, policyConfig, policyConfigAudit };
}

describe('getPolicyConfig', () => {
  it('returns the seed default at version 0 when no row exists', async () => {
    const { prisma, policyConfig } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue(null);

    const result = await getPolicyConfig(prisma, POLICY_CONFIG_KEYS.scoreThresholds);

    expect(result.version).toBe(0);
    expect(result.value).toEqual({ priorityA: 80, priorityB: 60, priorityC: 40, sqlMinimumAccountScore: 70 });
  });

  it('seeds forbiddenClaims from the CLAUDE.md defaults', async () => {
    const { prisma, policyConfig } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue(null);

    const result = await getPolicyConfig(prisma, POLICY_CONFIG_KEYS.forbiddenClaims);

    expect(result.value).toContain('100% accessible');
  });

  it('returns the stored row when one exists', async () => {
    const { prisma, policyConfig } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue({ key: 'score.thresholds', value: { priorityA: 90 }, version: 3 });

    const result = await getPolicyConfig(prisma, POLICY_CONFIG_KEYS.scoreThresholds);

    expect(result).toEqual({ key: 'score.thresholds', value: { priorityA: 90 }, version: 3 });
  });
});

describe('listPolicyConfigs', () => {
  it('returns one entry per known policy key', async () => {
    const { prisma, policyConfig } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue(null);

    const result = await listPolicyConfigs(prisma);

    expect(result.map((r) => r.key).sort()).toEqual(Object.values(POLICY_CONFIG_KEYS).sort());
  });
});

describe('updatePolicyConfig', () => {
  it('rejects a stale expectedVersion without writing anything', async () => {
    const { prisma, policyConfig } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue({ key: 'score.thresholds', value: {}, version: 3 });

    const result = await updatePolicyConfig(prisma, {
      key: POLICY_CONFIG_KEYS.scoreThresholds,
      value: { priorityA: 85 },
      expectedVersion: 2,
      updatedByUserId: 'user-1',
    });

    expect(result).toEqual({ kind: 'CONFLICT', currentVersion: 3 });
    expect(policyConfig.create).not.toHaveBeenCalled();
    expect(policyConfig.updateMany).not.toHaveBeenCalled();
  });

  it('creates the first version and an audit row when no row exists yet', async () => {
    const { prisma, policyConfig, policyConfigAudit } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue(null);
    policyConfig.create.mockResolvedValue({ key: 'forbiddenClaims', value: ['x'], version: 1 });

    const result = await updatePolicyConfig(prisma, {
      key: POLICY_CONFIG_KEYS.forbiddenClaims,
      value: ['x'],
      expectedVersion: 0,
      updatedByUserId: 'user-1',
    });

    expect(result).toEqual({ kind: 'UPDATED', config: { key: 'forbiddenClaims', value: ['x'], version: 1 } });
    expect(policyConfigAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ policyKey: 'forbiddenClaims', newValue: ['x'], version: 1, changedByUserId: 'user-1' }) }),
    );
  });

  it('returns CONFLICT when two first-writes race on the unique key constraint', async () => {
    const { prisma, policyConfig } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue(null);
    policyConfig.create.mockRejectedValue(uniqueConstraintError());
    policyConfig.findUniqueOrThrow.mockResolvedValue({ key: 'forbiddenClaims', value: ['raced'], version: 1 });

    const result = await updatePolicyConfig(prisma, {
      key: POLICY_CONFIG_KEYS.forbiddenClaims,
      value: ['x'],
      expectedVersion: 0,
      updatedByUserId: 'user-1',
    });

    expect(result).toEqual({ kind: 'CONFLICT', currentVersion: 1 });
  });

  it('updates an existing row via CAS on version and appends an audit row with the previous value', async () => {
    const { prisma, policyConfig, policyConfigAudit } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue({ key: 'score.thresholds', value: { priorityA: 80 }, version: 2 });
    policyConfig.updateMany.mockResolvedValue({ count: 1 });
    policyConfig.findUniqueOrThrow.mockResolvedValue({ key: 'score.thresholds', value: { priorityA: 85 }, version: 3 });

    const result = await updatePolicyConfig(prisma, {
      key: POLICY_CONFIG_KEYS.scoreThresholds,
      value: { priorityA: 85 },
      expectedVersion: 2,
      updatedByUserId: 'user-1',
    });

    expect(result).toEqual({ kind: 'UPDATED', config: { key: 'score.thresholds', value: { priorityA: 85 }, version: 3 } });
    expect(policyConfig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'score.thresholds', version: 2 } }),
    );
    expect(policyConfigAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previousValue: { priorityA: 80 }, newValue: { priorityA: 85 }, version: 3 }),
      }),
    );
  });

  it('returns CONFLICT when the CAS updateMany loses a concurrent race', async () => {
    const { prisma, policyConfig } = createMockPrisma();
    policyConfig.findUnique
      .mockResolvedValueOnce({ key: 'score.thresholds', value: {}, version: 2 })
      .mockResolvedValueOnce(undefined);
    policyConfig.updateMany.mockResolvedValue({ count: 0 });
    policyConfig.findUniqueOrThrow.mockResolvedValue({ key: 'score.thresholds', value: {}, version: 3 });

    const result = await updatePolicyConfig(prisma, {
      key: POLICY_CONFIG_KEYS.scoreThresholds,
      value: { priorityA: 85 },
      expectedVersion: 2,
      updatedByUserId: 'user-1',
    });

    expect(result).toEqual({ kind: 'CONFLICT', currentVersion: 3 });
  });
});

describe('listPolicyConfigAudit', () => {
  it('filters by policy key', async () => {
    const { prisma, policyConfigAudit } = createMockPrisma();
    policyConfigAudit.findMany.mockResolvedValue([]);

    await listPolicyConfigAudit(prisma, { key: POLICY_CONFIG_KEYS.scoreThresholds });

    expect(policyConfigAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { policyKey: 'score.thresholds' } }),
    );
  });
});
