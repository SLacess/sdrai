import {
  getPolicyConfig,
  listPolicyConfigAudit,
  POLICY_CONFIG_KEYS,
  type PolicyConfigAudit,
  type PolicyConfigKey,
  type PrismaClient,
} from '@sinal/db';

export interface PolicyOverviewItem {
  key: PolicyConfigKey;
  value: unknown;
  version: number;
  recentAudit: PolicyConfigAudit[];
}

const AUDIT_HISTORY_LIMIT = 10;

/** One row per known policy key, each paired with its own recent audit trail — "versioned and audited" made visible. */
export async function loadPolicyOverview(prisma: PrismaClient): Promise<PolicyOverviewItem[]> {
  const keys = Object.values(POLICY_CONFIG_KEYS);
  return Promise.all(
    keys.map(async (key) => {
      const [config, recentAudit] = await Promise.all([
        getPolicyConfig(prisma, key),
        listPolicyConfigAudit(prisma, { key, limit: AUDIT_HISTORY_LIMIT }),
      ]);
      return { key: config.key, value: config.value, version: config.version, recentAudit };
    }),
  );
}
