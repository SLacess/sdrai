import { describe, expect, it } from 'vitest';
import { hasSufficientSampleForProposal, MIN_LEARNING_SAMPLE_SIZE } from './learning';

describe('hasSufficientSampleForProposal', () => {
  it('rejects a sample below the minimum', () => {
    expect(hasSufficientSampleForProposal(MIN_LEARNING_SAMPLE_SIZE - 1)).toBe(false);
  });

  it('accepts a sample exactly at the minimum', () => {
    expect(hasSufficientSampleForProposal(MIN_LEARNING_SAMPLE_SIZE)).toBe(true);
  });

  it('accepts a sample above the minimum', () => {
    expect(hasSufficientSampleForProposal(MIN_LEARNING_SAMPLE_SIZE + 100)).toBe(true);
  });

  it('rejects a zero sample', () => {
    expect(hasSufficientSampleForProposal(0)).toBe(false);
  });
});
