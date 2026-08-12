export interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export type PricingTable = Record<string, ModelPricing>;

/**
 * Returns null (not a fabricated number) when the model isn't in the caller's
 * pricing table. This project never asserts commercial figures it can't cite
 * (CLAUDE.md), so cost tracking must be explicitly configured with real,
 * sourced rates rather than defaulting to invented pricing.
 */
export function estimateCostMicrosUsd(
  pricing: PricingTable,
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number | null {
  const rate = pricing[model];
  if (!rate) return null;
  const usd = (tokensInput / 1_000_000) * rate.inputPerMillionUsd + (tokensOutput / 1_000_000) * rate.outputPerMillionUsd;
  return Math.round(usd * 1_000_000);
}
