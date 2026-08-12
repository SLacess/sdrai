import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { syncAccountToHubSpot, type CrmAdapter } from './hubspot-sync-service';

function createMockPrisma() {
  const account = { findUniqueOrThrow: vi.fn(), update: vi.fn() };
  return { prisma: { account } as unknown as PrismaClient, account };
}

function createMockAdapter() {
  const upsert = vi.fn();
  return { adapter: { upsert } as CrmAdapter, upsert };
}

describe('syncAccountToHubSpot', () => {
  it('creates a new HubSpot company and persists the returned hubspotId', async () => {
    const { prisma, account } = createMockPrisma();
    account.findUniqueOrThrow.mockResolvedValue({ id: 'acc-1', hubspotId: null });
    const { adapter, upsert } = createMockAdapter();
    upsert.mockResolvedValue({ externalId: 'hs-new-1', operation: 'CREATE' });

    const result = await syncAccountToHubSpot(prisma, adapter, { accountId: 'acc-1', fields: { name: 'Acme' } });

    expect(result).toEqual({ externalId: 'hs-new-1', operation: 'CREATE', skippedFields: [] });
    expect(upsert).toHaveBeenCalledWith({ objectType: 'COMPANY', externalId: null, fields: { name: 'Acme' } });
    expect(account.update).toHaveBeenCalledWith({ where: { id: 'acc-1' }, data: { hubspotId: 'hs-new-1' } });
  });

  it('does not rewrite hubspotId when it already matches', async () => {
    const { prisma, account } = createMockPrisma();
    account.findUniqueOrThrow.mockResolvedValue({ id: 'acc-1', hubspotId: 'hs-1' });
    const { adapter, upsert } = createMockAdapter();
    upsert.mockResolvedValue({ externalId: 'hs-1', operation: 'UPDATE' });

    await syncAccountToHubSpot(prisma, adapter, { accountId: 'acc-1', fields: { name: 'Acme' } });

    expect(account.update).not.toHaveBeenCalled();
  });

  it('strips authoritative fields before they ever reach the adapter', async () => {
    const { prisma, account } = createMockPrisma();
    account.findUniqueOrThrow.mockResolvedValue({ id: 'acc-1', hubspotId: 'hs-1' });
    const { adapter, upsert } = createMockAdapter();
    upsert.mockResolvedValue({ externalId: 'hs-1', operation: 'UPDATE' });

    const result = await syncAccountToHubSpot(prisma, adapter, {
      accountId: 'acc-1',
      fields: { name: 'Acme', ownerId: 'rep-1' },
      authoritativeFields: ['ownerId'],
    });

    expect(upsert).toHaveBeenCalledWith({ objectType: 'COMPANY', externalId: 'hs-1', fields: { name: 'Acme' } });
    expect(result.skippedFields).toEqual(['ownerId']);
  });
});
