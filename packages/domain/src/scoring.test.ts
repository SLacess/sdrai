import { describe, expect, it } from 'vitest';
import { ACCOUNT_SCORE_WEIGHTS, calculateAccountScore, type AccountScoreFactors } from './scoring';

function factors(value: number): AccountScoreFactors {
  return {
    companyFit: value,
    digitalExposure: value,
    accessibilityOpportunity: value,
    inclusionEsgSignal: value,
    commercialTriggerTiming: value,
    buyingCommitteeQuality: value,
    engagement: value,
  };
}

describe('ACCOUNT_SCORE_WEIGHTS', () => {
  it('sums to 1.0 so a uniform factor score reproduces the input value as the total', () => {
    const sum = Object.values(ACCOUNT_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

describe('calculateAccountScore', () => {
  it('produces the expected total and band for a known mixed-factor fixture', () => {
    const result = calculateAccountScore({
      companyFit: 90,
      digitalExposure: 70,
      accessibilityOpportunity: 85,
      inclusionEsgSignal: 50,
      commercialTriggerTiming: 60,
      buyingCommitteeQuality: 40,
      engagement: 30,
    });
    expect(result.total).toBe(71.75);
    expect(result.priority).toBe('B');
  });

  it('rounds the weighted total to 2 decimal places', () => {
    const result = calculateAccountScore({ ...factors(0), companyFit: 33.333 });
    // 33.333 * 0.25 = 8.33325 -> rounds to 8.33
    expect(result.total).toBe(8.33);
  });

  it.each([
    [100, 100, 'A'],
    [80, 80, 'A'],
    [79, 79, 'B'],
    [60, 60, 'B'],
    [59, 59, 'C'],
    [40, 40, 'C'],
    [39, 39, 'BELOW_THRESHOLD'],
    [0, 0, 'BELOW_THRESHOLD'],
  ] as const)('uniform factor score of %i produces total %i and band %s', (input, expectedTotal, expectedBand) => {
    const result = calculateAccountScore(factors(input));
    expect(result.total).toBe(expectedTotal);
    expect(result.priority).toBe(expectedBand);
  });

  it('rejects a factor below 0', () => {
    expect(() => calculateAccountScore({ ...factors(50), companyFit: -1 })).toThrow('companyFit must be 0..100');
  });

  it('rejects a factor above 100', () => {
    expect(() => calculateAccountScore({ ...factors(50), engagement: 101 })).toThrow('engagement must be 0..100');
  });
});
