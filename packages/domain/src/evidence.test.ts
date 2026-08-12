import { describe, expect, it } from 'vitest';
import { checkRequiredEvidence, filterActiveEvidence, isEvidenceExpired } from './evidence';

const NOW = new Date('2026-08-11T12:00:00.000Z');

describe('isEvidenceExpired', () => {
  it('is never expired when expiresAt is null', () => {
    expect(isEvidenceExpired(null, NOW)).toBe(false);
  });

  it('is expired when expiresAt is in the past', () => {
    expect(isEvidenceExpired(new Date('2026-08-01T00:00:00.000Z'), NOW)).toBe(true);
  });

  it('is expired exactly at the expiry instant (inclusive boundary)', () => {
    expect(isEvidenceExpired(NOW, NOW)).toBe(true);
  });

  it('is not expired when expiresAt is in the future', () => {
    expect(isEvidenceExpired(new Date('2026-09-01T00:00:00.000Z'), NOW)).toBe(false);
  });
});

describe('filterActiveEvidence', () => {
  it('keeps only non-expired items', () => {
    const items = [
      { id: 'a', expiresAt: null },
      { id: 'b', expiresAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'c', expiresAt: new Date('2026-12-01T00:00:00.000Z') },
    ];
    expect(filterActiveEvidence(items, NOW).map((i) => i.id)).toEqual(['a', 'c']);
  });
});

describe('checkRequiredEvidence', () => {
  it('reports allPresent when every required id exists and is unexpired', () => {
    const available = [
      { id: 'ev-1', expiresAt: null },
      { id: 'ev-2', expiresAt: new Date('2027-01-01T00:00:00.000Z') },
    ];
    const result = checkRequiredEvidence(['ev-1', 'ev-2'], available, NOW);
    expect(result).toEqual({ allPresent: true, missingIds: [], expiredIds: [] });
  });

  it('flags missing ids that do not exist in the available set', () => {
    const result = checkRequiredEvidence(['ev-1', 'ev-missing'], [{ id: 'ev-1', expiresAt: null }], NOW);
    expect(result.allPresent).toBe(false);
    expect(result.missingIds).toEqual(['ev-missing']);
    expect(result.expiredIds).toEqual([]);
  });

  it('flags expired ids separately from missing ids', () => {
    const available = [{ id: 'ev-1', expiresAt: new Date('2020-01-01T00:00:00.000Z') }];
    const result = checkRequiredEvidence(['ev-1'], available, NOW);
    expect(result.allPresent).toBe(false);
    expect(result.expiredIds).toEqual(['ev-1']);
    expect(result.missingIds).toEqual([]);
  });

  it('is allPresent=true only when there are zero missing and zero expired ids', () => {
    const available = [
      { id: 'ev-1', expiresAt: null },
      { id: 'ev-2', expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    ];
    const result = checkRequiredEvidence(['ev-1', 'ev-2', 'ev-3'], available, NOW);
    expect(result.allPresent).toBe(false);
    expect(result.expiredIds).toEqual(['ev-2']);
    expect(result.missingIds).toEqual(['ev-3']);
  });

  it('returns allPresent=true for an empty required list', () => {
    expect(checkRequiredEvidence([], [], NOW)).toEqual({ allPresent: true, missingIds: [], expiredIds: [] });
  });
});
