import { describe, expect, it } from 'vitest';
import { MockHubSpotAdapter } from './mock-adapter';

describe('MockHubSpotAdapter', () => {
  it('creates a new record and generates an externalId when none is given', async () => {
    const adapter = new MockHubSpotAdapter();
    const result = await adapter.upsert({ objectType: 'COMPANY', externalId: null, fields: { name: 'Acme' } });
    expect(result.operation).toBe('CREATE');
    expect(result.externalId).toMatch(/^mock-hs-/);
  });

  it('updates and merges fields when the externalId already exists', async () => {
    const adapter = new MockHubSpotAdapter();
    const created = await adapter.upsert({ objectType: 'COMPANY', externalId: null, fields: { name: 'Acme', sector: 'Retail' } });

    const updated = await adapter.upsert({ objectType: 'COMPANY', externalId: created.externalId, fields: { sector: 'E-commerce' } });

    expect(updated.operation).toBe('UPDATE');
    const record = await adapter.getRecord('COMPANY', created.externalId);
    expect(record).toEqual({ name: 'Acme', sector: 'E-commerce' });
  });

  it('creates under a caller-supplied externalId that is not yet in the store', async () => {
    const adapter = new MockHubSpotAdapter();
    const result = await adapter.upsert({ objectType: 'CONTACT', externalId: 'hs-known-1', fields: { email: 'jane@acme.com' } });
    expect(result).toEqual({ externalId: 'hs-known-1', operation: 'CREATE' });
  });

  it('getRecord returns null for a record that was never created', async () => {
    const adapter = new MockHubSpotAdapter();
    expect(await adapter.getRecord('DEAL', 'missing')).toBeNull();
  });

  it('seed() pre-populates a record as if it already existed in HubSpot', async () => {
    const adapter = new MockHubSpotAdapter();
    adapter.seed('COMPANY', 'hs-1', { name: 'Acme', ownerId: 'rep-1' });

    expect(await adapter.getRecord('COMPANY', 'hs-1')).toEqual({ name: 'Acme', ownerId: 'rep-1' });
    const updated = await adapter.upsert({ objectType: 'COMPANY', externalId: 'hs-1', fields: { name: 'Acme Renamed' } });
    expect(updated.operation).toBe('UPDATE');
  });

  it('keeps COMPANY/CONTACT/DEAL records with the same externalId separate', async () => {
    const adapter = new MockHubSpotAdapter();
    adapter.seed('COMPANY', 'shared-id', { kind: 'company' });
    adapter.seed('CONTACT', 'shared-id', { kind: 'contact' });

    expect(await adapter.getRecord('COMPANY', 'shared-id')).toEqual({ kind: 'company' });
    expect(await adapter.getRecord('CONTACT', 'shared-id')).toEqual({ kind: 'contact' });
  });
});
