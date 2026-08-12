export const ACCOUNT_SCORE_WEIGHTS = {
  companyFit: 0.25,
  digitalExposure: 0.15,
  accessibilityOpportunity: 0.25,
  inclusionEsgSignal: 0.10,
  commercialTriggerTiming: 0.15,
  buyingCommitteeQuality: 0.05,
  engagement: 0.05,
} as const;

export type AccountScoreFactors = Record<keyof typeof ACCOUNT_SCORE_WEIGHTS, number>;

export function calculateAccountScore(f: AccountScoreFactors) {
  for (const [k,v] of Object.entries(f)) if (v < 0 || v > 100) throw new Error(`${k} must be 0..100`);
  const total = Object.entries(ACCOUNT_SCORE_WEIGHTS)
    .reduce((sum,[k,w]) => sum + f[k as keyof AccountScoreFactors] * w, 0);
  const rounded = Math.round(total * 100) / 100;
  return { total: rounded, priority: rounded >= 80 ? 'A' : rounded >= 60 ? 'B' : rounded >= 40 ? 'C' : 'BELOW_THRESHOLD' } as const;
}
