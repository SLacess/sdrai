import type { HubSpotAdapter, HubSpotObjectType, HubSpotUpsertInput, HubSpotUpsertResult } from './types';

function storeKey(objectType: HubSpotObjectType, externalId: string): string {
  return `${objectType}:${externalId}`;
}

/**
 * In-memory stand-in for the real HubSpot API — no credential available in
 * this environment (HUBSPOT_ACCESS_TOKEN in .env.example is blank).
 * Upsert-by-externalId semantics match HubSpot's own idempotent upsert
 * behavior closely enough for BP-028/029's precedence and reconciliation
 * logic to be exercised honestly.
 */
export class MockHubSpotAdapter implements HubSpotAdapter {
  readonly name = 'mock';
  private readonly store = new Map<string, Record<string, unknown>>();
  private counter = 0;

  async upsert(input: HubSpotUpsertInput): Promise<HubSpotUpsertResult> {
    if (input.externalId) {
      const key = storeKey(input.objectType, input.externalId);
      const existing = this.store.get(key);
      if (existing) {
        this.store.set(key, { ...existing, ...input.fields });
        return { externalId: input.externalId, operation: 'UPDATE' };
      }
      this.store.set(key, { ...input.fields });
      return { externalId: input.externalId, operation: 'CREATE' };
    }

    const externalId = `mock-hs-${++this.counter}`;
    this.store.set(storeKey(input.objectType, externalId), { ...input.fields });
    return { externalId, operation: 'CREATE' };
  }

  async getRecord(objectType: HubSpotObjectType, externalId: string): Promise<Record<string, unknown> | null> {
    return this.store.get(storeKey(objectType, externalId)) ?? null;
  }

  /** Test/dev helper to seed a record as if it already existed in HubSpot. */
  seed(objectType: HubSpotObjectType, externalId: string, fields: Record<string, unknown>): void {
    this.store.set(storeKey(objectType, externalId), { ...fields });
  }
}
