import { describe, expect, it } from 'vitest';
import { applyFieldPrecedence } from './crm-field-precedence';

describe('applyFieldPrecedence', () => {
  it('passes through all fields when none are authoritative', () => {
    const result = applyFieldPrecedence({ name: 'Acme', domain: 'acme.com' }, { authoritativeFields: [] });
    expect(result).toEqual({ fields: { name: 'Acme', domain: 'acme.com' }, skippedFields: [] });
  });

  it('strips a manually authoritative field from the outgoing payload', () => {
    const result = applyFieldPrecedence(
      { name: 'Acme', ownerId: 'sales-rep-1', dealamount: 50000 },
      { authoritativeFields: ['ownerId', 'dealamount'] },
    );
    expect(result.fields).toEqual({ name: 'Acme' });
    expect(result.skippedFields).toEqual(['ownerId', 'dealamount']);
  });

  it('leaves the manual field entirely absent from the payload — never sent as null/undefined either', () => {
    const result = applyFieldPrecedence({ closedate: '2026-09-01' }, { authoritativeFields: ['closedate'] });
    expect(result.fields).not.toHaveProperty('closedate');
  });

  it('is a no-op for an empty proposed field set', () => {
    expect(applyFieldPrecedence({}, { authoritativeFields: ['ownerId'] })).toEqual({ fields: {}, skippedFields: [] });
  });

  it('ignores authoritative field names that are not present in the proposal', () => {
    const result = applyFieldPrecedence({ name: 'Acme' }, { authoritativeFields: ['ownerId'] });
    expect(result).toEqual({ fields: { name: 'Acme' }, skippedFields: [] });
  });
});
