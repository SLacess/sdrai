import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApifyLeadProvider } from './apify-lead-provider';

const originalFetch = global.fetch;

describe('ApifyLeadProvider', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls the run-sync-get-dataset-items endpoint with the token and mapped input', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [{ company: 'Acme', site: 'acme.com' }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ApifyLeadProvider({
      apiToken: 'secret-token',
      actorId: 'org/lead-finder',
      buildActorInput: (params) => ({ maxItems: params.limit }),
      mapDatasetItem: (item) => ({ brandName: item.company as string, domain: item.site as string, sourceUris: [`https://${item.site as string}`] }),
    });

    const candidates = await provider.discoverAccounts({ limit: 5 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.apify.com/v2/acts/org%2Flead-finder/run-sync-get-dataset-items?token=secret-token',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxItems: 5 }) },
    );
    expect(candidates).toEqual([{ brandName: 'Acme', domain: 'acme.com', sourceUris: ['https://acme.com'] }]);
  });

  it('drops dataset items the mapper rejects', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [{ site: 'acme.com' }, { junk: true }],
    }) as unknown as typeof fetch;

    const provider = new ApifyLeadProvider({
      apiToken: 't',
      actorId: 'a',
      buildActorInput: () => ({}),
      mapDatasetItem: (item) => (typeof item.site === 'string' ? { brandName: 'Acme', domain: item.site, sourceUris: [] } : null),
    });

    const candidates = await provider.discoverAccounts({ limit: 10 });
    expect(candidates).toHaveLength(1);
  });

  it('caps returned candidates at the requested limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => Array.from({ length: 5 }, (_, i) => ({ site: `acme-${i}.com` })),
    }) as unknown as typeof fetch;

    const provider = new ApifyLeadProvider({
      apiToken: 't',
      actorId: 'a',
      buildActorInput: () => ({}),
      mapDatasetItem: (item) => ({ brandName: 'Acme', domain: item.site as string, sourceUris: [] }),
    });

    const candidates = await provider.discoverAccounts({ limit: 2 });
    expect(candidates).toHaveLength(2);
  });

  it('throws a descriptive error when the actor run fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' }) as unknown as typeof fetch;

    const provider = new ApifyLeadProvider({
      apiToken: 'bad',
      actorId: 'org/lead-finder',
      buildActorInput: () => ({}),
      mapDatasetItem: () => null,
    });

    await expect(provider.discoverAccounts({ limit: 1 })).rejects.toThrow(
      'Apify actor "org/lead-finder" run failed: 401 Unauthorized',
    );
  });
});
