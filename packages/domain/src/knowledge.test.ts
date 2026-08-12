import { describe, expect, it } from 'vitest';
import { isKnowledgeItemUsable } from './knowledge';

const NOW = new Date('2026-08-11T12:00:00.000Z');

describe('isKnowledgeItemUsable', () => {
  it('rejects a DRAFT item regardless of its validity window', () => {
    expect(isKnowledgeItemUsable({ approvalState: 'DRAFT', validFrom: null, validUntil: null }, NOW)).toBe(false);
  });

  it('rejects a DEPRECATED item', () => {
    expect(isKnowledgeItemUsable({ approvalState: 'DEPRECATED', validFrom: null, validUntil: null }, NOW)).toBe(false);
  });

  it('accepts an APPROVED item with no validity window set', () => {
    expect(isKnowledgeItemUsable({ approvalState: 'APPROVED', validFrom: null, validUntil: null }, NOW)).toBe(true);
  });

  it('rejects an APPROVED item whose validFrom is still in the future', () => {
    const item = { approvalState: 'APPROVED' as const, validFrom: new Date('2026-09-01T00:00:00.000Z'), validUntil: null };
    expect(isKnowledgeItemUsable(item, NOW)).toBe(false);
  });

  it('rejects an APPROVED item whose validUntil has already passed', () => {
    const item = { approvalState: 'APPROVED' as const, validFrom: null, validUntil: new Date('2026-01-01T00:00:00.000Z') };
    expect(isKnowledgeItemUsable(item, NOW)).toBe(false);
  });

  it('accepts an APPROVED item currently inside its validity window', () => {
    const item = {
      approvalState: 'APPROVED' as const,
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: new Date('2026-12-31T00:00:00.000Z'),
    };
    expect(isKnowledgeItemUsable(item, NOW)).toBe(true);
  });
});
