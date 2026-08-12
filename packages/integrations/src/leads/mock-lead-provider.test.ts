import { describe, expect, it } from 'vitest';
import { MockLeadProvider } from './mock-lead-provider';

describe('MockLeadProvider', () => {
  it('returns up to `limit` fixture candidates, each with at least one source URI', async () => {
    const provider = new MockLeadProvider();
    const candidates = await provider.discoverAccounts({ limit: 2 });
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(candidate.sourceUris.length).toBeGreaterThan(0);
      expect(candidate.domain).toMatch(/\./);
    }
  });

  it('never returns more candidates than the fixture set has, even for a huge limit', async () => {
    const provider = new MockLeadProvider();
    const candidates = await provider.discoverAccounts({ limit: 10_000 });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(10);
  });

  it('returns no candidates for a limit of 0', async () => {
    const provider = new MockLeadProvider();
    expect(await provider.discoverAccounts({ limit: 0 })).toEqual([]);
  });

  it('produces unique domains across the fixture set (dedupe-friendly)', async () => {
    const provider = new MockLeadProvider();
    const candidates = await provider.discoverAccounts({ limit: 10_000 });
    const domains = candidates.map((c) => c.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });
});
