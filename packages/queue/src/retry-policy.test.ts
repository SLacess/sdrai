import { describe, expect, it } from 'vitest';
import { computeBackoffDelayMs, isFinalAttempt, MAX_ATTEMPTS } from './retry-policy';

describe('computeBackoffDelayMs', () => {
  it.each([
    [1, 2000],
    [2, 4000],
    [3, 8000],
    [4, 16000],
    [5, 32000],
  ])('doubles delay for attempt %i -> %ims', (attemptsMade, expected) => {
    expect(computeBackoffDelayMs(attemptsMade, 2000)).toBe(expected);
  });

  it('rejects attemptsMade below 1', () => {
    expect(() => computeBackoffDelayMs(0)).toThrow();
  });

  it('respects a custom base delay', () => {
    expect(computeBackoffDelayMs(1, 500)).toBe(500);
    expect(computeBackoffDelayMs(3, 500)).toBe(2000);
  });
});

describe('isFinalAttempt', () => {
  it.each([
    [1, false],
    [4, false],
    [5, true],
    [6, true],
  ])('attemptsMade=%i against default max -> %s', (attemptsMade, expected) => {
    expect(isFinalAttempt(attemptsMade)).toBe(expected);
  });

  it('uses MAX_ATTEMPTS as the default threshold', () => {
    expect(isFinalAttempt(MAX_ATTEMPTS)).toBe(true);
    expect(isFinalAttempt(MAX_ATTEMPTS - 1)).toBe(false);
  });

  it('honors a custom max attempts', () => {
    expect(isFinalAttempt(2, 2)).toBe(true);
    expect(isFinalAttempt(1, 2)).toBe(false);
  });
});
