import { Prisma, type PolicyConfig, type PolicyConfigAudit, type PrismaClient } from '@prisma/client';
import { DEFAULT_FORBIDDEN_CLAIMS } from '@sinal/domain';

export const POLICY_CONFIG_KEYS = {
  scoreThresholds: 'score.thresholds',
  frequencyCaps: 'frequency.caps',
  forbiddenClaims: 'forbiddenClaims',
} as const;

export type PolicyConfigKey = (typeof POLICY_CONFIG_KEYS)[keyof typeof POLICY_CONFIG_KEYS];

/** Seed values mirror config/defaults.yaml — used only when no row exists yet for a key. */
const POLICY_CONFIG_DEFAULTS: Record<PolicyConfigKey, Prisma.InputJsonValue> = {
  [POLICY_CONFIG_KEYS.scoreThresholds]: { priorityA: 80, priorityB: 60, priorityC: 40, sqlMinimumAccountScore: 70 },
  [POLICY_CONFIG_KEYS.frequencyCaps]: { maxFirstTouchPerAccountDepartmentPerDay: 1 },
  [POLICY_CONFIG_KEYS.forbiddenClaims]: [...DEFAULT_FORBIDDEN_CLAIMS],
};

export interface PolicyConfigView {
  key: PolicyConfigKey;
  value: Prisma.JsonValue;
  version: number;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Returns the seed default (version 0) if no row exists yet — never null, so callers don't need a fallback branch. */
export async function getPolicyConfig(prisma: PrismaClient, key: PolicyConfigKey): Promise<PolicyConfigView> {
  const existing = await prisma.policyConfig.findUnique({ where: { key } });
  if (existing) return { key: existing.key as PolicyConfigKey, value: existing.value, version: existing.version };
  return { key, value: POLICY_CONFIG_DEFAULTS[key] as Prisma.JsonValue, version: 0 };
}

export async function listPolicyConfigs(prisma: PrismaClient): Promise<PolicyConfigView[]> {
  return Promise.all(Object.values(POLICY_CONFIG_KEYS).map((key) => getPolicyConfig(prisma, key)));
}

export interface UpdatePolicyConfigParams {
  key: PolicyConfigKey;
  value: Prisma.InputJsonValue;
  expectedVersion: number;
  updatedByUserId: string;
}

export type UpdatePolicyConfigOutcome =
  | { kind: 'UPDATED'; config: PolicyConfig }
  | { kind: 'CONFLICT'; currentVersion: number };

/**
 * Every successful write is a single transaction: bump the row's version
 * and append an immutable PolicyConfigAudit row recording who changed what
 * from what — "versioned and audited" holds because there is no other path
 * in this module that mutates a PolicyConfig row. expectedVersion is a CAS
 * guard (same updateMany-on-version pattern as approval/meeting services)
 * against a stale concurrent edit silently overwriting someone else's
 * change; a race on first-write-for-a-key is caught via the key's unique
 * constraint instead, since there's no existing row/version to condition on.
 */
export async function updatePolicyConfig(
  prisma: PrismaClient,
  params: UpdatePolicyConfigParams,
): Promise<UpdatePolicyConfigOutcome> {
  const existing = await prisma.policyConfig.findUnique({ where: { key: params.key } });
  const currentVersion = existing?.version ?? 0;

  if (currentVersion !== params.expectedVersion) {
    return { kind: 'CONFLICT', currentVersion };
  }

  if (!existing) {
    try {
      const config = await prisma.$transaction(async (tx) => {
        const created = await tx.policyConfig.create({
          data: { key: params.key, value: params.value, version: 1, updatedByUserId: params.updatedByUserId },
        });
        await tx.policyConfigAudit.create({
          data: { policyKey: params.key, newValue: params.value, version: 1, changedByUserId: params.updatedByUserId },
        });
        return created;
      });
      return { kind: 'UPDATED', config };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const raced = await prisma.policyConfig.findUniqueOrThrow({ where: { key: params.key } });
      return { kind: 'CONFLICT', currentVersion: raced.version };
    }
  }

  const nextVersion = currentVersion + 1;
  const previousValue = existing.value as Prisma.InputJsonValue;

  const config = await prisma.$transaction(async (tx) => {
    const updated = await tx.policyConfig.updateMany({
      where: { key: params.key, version: currentVersion },
      data: { value: params.value, version: nextVersion, updatedByUserId: params.updatedByUserId },
    });
    if (updated.count === 0) return null;

    await tx.policyConfigAudit.create({
      data: {
        policyKey: params.key,
        previousValue,
        newValue: params.value,
        version: nextVersion,
        changedByUserId: params.updatedByUserId,
      },
    });
    return tx.policyConfig.findUniqueOrThrow({ where: { key: params.key } });
  });

  if (!config) {
    const raced = await prisma.policyConfig.findUniqueOrThrow({ where: { key: params.key } });
    return { kind: 'CONFLICT', currentVersion: raced.version };
  }

  return { kind: 'UPDATED', config };
}

export interface ListPolicyConfigAuditParams {
  key: PolicyConfigKey;
  limit?: number;
}

export async function listPolicyConfigAudit(
  prisma: PrismaClient,
  params: ListPolicyConfigAuditParams,
): Promise<PolicyConfigAudit[]> {
  return prisma.policyConfigAudit.findMany({
    where: { policyKey: params.key },
    orderBy: { changedAt: 'desc' },
    take: params.limit ?? 50,
  });
}
