import { describe, expect, it } from 'vitest';
import { allocateEvidenceIds } from './evidence-allocation';

describe('allocateEvidenceIds', () => {
  it('assigns a unique evidenceId to each source', () => {
    const allocated = allocateEvidenceIds([
      { sourceUri: 'https://acme.com', rawContent: 'a' },
      { sourceUri: 'https://acme.com/about', rawContent: 'b' },
    ]);
    expect(allocated).toHaveLength(2);
    expect(new Set(allocated.map((a) => a.evidenceId)).size).toBe(2);
    for (const a of allocated) expect(a.evidenceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('preserves sourceUri and rawContent unchanged', () => {
    const [allocated] = allocateEvidenceIds([{ sourceUri: 'https://acme.com', rawContent: 'hello' }]);
    expect(allocated).toMatchObject({ sourceUri: 'https://acme.com', rawContent: 'hello' });
  });

  it('returns an empty array for no sources', () => {
    expect(allocateEvidenceIds([])).toEqual([]);
  });
});
