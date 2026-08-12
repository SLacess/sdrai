import { describe, expect, it, vi } from 'vitest';
import { applyCrmSyncOperations, type CrmSyncOperationInput } from './crm-reconciliation-service';
import type { CrmAdapter } from './hubspot-sync-service';

function createMockAdapter() {
  const upsert = vi.fn();
  return { adapter: { upsert } as CrmAdapter, upsert };
}

function op(overrides: Partial<CrmSyncOperationInput> = {}): CrmSyncOperationInput {
  return {
    object: 'COMPANY',
    operation: 'UPDATE',
    externalId: 'hs-1',
    fields: { name: 'Acme' },
    authoritativeConflicts: [],
    ...overrides,
  };
}

describe('applyCrmSyncOperations', () => {
  it('skips NOOP operations without calling the adapter', async () => {
    const { adapter, upsert } = createMockAdapter();
    const summary = await applyCrmSyncOperations(adapter, [op({ operation: 'NOOP' })]);
    expect(summary).toEqual({ created: 0, updated: 0, skipped: 1, conflicts: [] });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('reports a CONFLICT operation and never writes it', async () => {
    const { adapter, upsert } = createMockAdapter();
    const summary = await applyCrmSyncOperations(adapter, [op({ operation: 'CONFLICT', externalId: 'hs-2' })]);
    expect(summary.conflicts).toEqual([{ object: 'COMPANY', externalId: 'hs-2', reason: 'Agent flagged a conflict' }]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('treats an UPDATE carrying authoritativeConflicts as a conflict, not a write', async () => {
    const { adapter, upsert } = createMockAdapter();
    const summary = await applyCrmSyncOperations(adapter, [
      op({ operation: 'UPDATE', authoritativeConflicts: ['ownerId'] }),
    ]);
    expect(summary.conflicts).toEqual([
      { object: 'COMPANY', externalId: 'hs-1', reason: 'Authoritative field conflict: ownerId' },
    ]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('creates a new record and counts it', async () => {
    const { adapter, upsert } = createMockAdapter();
    upsert.mockResolvedValue({ externalId: 'hs-new', operation: 'CREATE' });

    const summary = await applyCrmSyncOperations(adapter, [op({ operation: 'CREATE', externalId: null })]);

    expect(summary).toEqual({ created: 1, updated: 0, skipped: 0, conflicts: [] });
  });

  it('updates an existing record and counts it', async () => {
    const { adapter, upsert } = createMockAdapter();
    upsert.mockResolvedValue({ externalId: 'hs-1', operation: 'UPDATE' });

    const summary = await applyCrmSyncOperations(adapter, [op()]);
    expect(summary).toEqual({ created: 0, updated: 1, skipped: 0, conflicts: [] });
  });

  it('applies per-object authoritative field precedence before calling the adapter', async () => {
    const { adapter, upsert } = createMockAdapter();
    upsert.mockResolvedValue({ externalId: 'hs-1', operation: 'UPDATE' });

    await applyCrmSyncOperations(
      adapter,
      [op({ fields: { name: 'Acme', ownerId: 'rep-1' } })],
      { COMPANY: ['ownerId'] },
    );

    expect(upsert).toHaveBeenCalledWith({ objectType: 'COMPANY', externalId: 'hs-1', fields: { name: 'Acme' } });
  });

  it('skips NOTE/ACTIVITY operations (not upsertable through this adapter surface)', async () => {
    const { adapter, upsert } = createMockAdapter();
    const summary = await applyCrmSyncOperations(adapter, [op({ object: 'NOTE', operation: 'CREATE' })]);
    expect(summary.skipped).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('is safe to apply the same UPDATE batch twice (idempotent upsert, no duplication)', async () => {
    const { adapter, upsert } = createMockAdapter();
    upsert.mockResolvedValue({ externalId: 'hs-1', operation: 'UPDATE' });
    const operations = [op()];

    const first = await applyCrmSyncOperations(adapter, operations);
    const second = await applyCrmSyncOperations(adapter, operations);

    expect(first).toEqual(second);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(1, { objectType: 'COMPANY', externalId: 'hs-1', fields: { name: 'Acme' } });
    expect(upsert).toHaveBeenNthCalledWith(2, { objectType: 'COMPANY', externalId: 'hs-1', fields: { name: 'Acme' } });
  });

  it('aggregates a mixed batch correctly', async () => {
    const { adapter, upsert } = createMockAdapter();
    upsert
      .mockResolvedValueOnce({ externalId: 'hs-new', operation: 'CREATE' })
      .mockResolvedValueOnce({ externalId: 'hs-1', operation: 'UPDATE' });

    const summary = await applyCrmSyncOperations(adapter, [
      op({ operation: 'CREATE', externalId: null }),
      op({ operation: 'UPDATE', externalId: 'hs-1' }),
      op({ operation: 'NOOP' }),
      op({ operation: 'CONFLICT', externalId: 'hs-3' }),
    ]);

    expect(summary).toEqual({
      created: 1,
      updated: 1,
      skipped: 1,
      conflicts: [{ object: 'COMPANY', externalId: 'hs-3', reason: 'Agent flagged a conflict' }],
    });
  });
});
