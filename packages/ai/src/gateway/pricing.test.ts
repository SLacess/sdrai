import { describe, expect, it } from 'vitest';
import { estimateCostMicrosUsd, type PricingTable } from './pricing';

describe('estimateCostMicrosUsd', () => {
  it('returns null for a model with no configured pricing (never fabricates a cost)', () => {
    expect(estimateCostMicrosUsd({}, 'unknown-model', 1000, 1000)).toBeNull();
  });

  it('computes cost in micros-USD from a caller-supplied pricing table', () => {
    const pricing: PricingTable = { 'claude-sonnet-5': { inputPerMillionUsd: 3, outputPerMillionUsd: 15 } };
    // 1,000,000 input tokens @ $3/M + 1,000,000 output tokens @ $15/M = $18.00 = 18,000,000 micros
    expect(estimateCostMicrosUsd(pricing, 'claude-sonnet-5', 1_000_000, 1_000_000)).toBe(18_000_000);
  });

  it('scales proportionally for partial token counts', () => {
    const pricing: PricingTable = { m: { inputPerMillionUsd: 10, outputPerMillionUsd: 20 } };
    // 100,000 input tokens @ $10/M = $1.00; 50,000 output tokens @ $20/M = $1.00 -> $2.00 = 2,000,000 micros
    expect(estimateCostMicrosUsd(pricing, 'm', 100_000, 50_000)).toBe(2_000_000);
  });
});
