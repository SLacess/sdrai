import type { DiscoverAccountsParams, DiscoveredAccountCandidate, LeadProvider } from './types';

export interface ApifyLeadProviderOptions {
  apiToken: string;
  actorId: string;
  /** Maps our generic discovery params to this specific actor's input schema. */
  buildActorInput: (params: DiscoverAccountsParams) => Record<string, unknown>;
  /** Maps one raw dataset item to our candidate shape, or null to skip it. */
  mapDatasetItem: (item: Record<string, unknown>) => DiscoveredAccountCandidate | null;
  baseUrl?: string;
}

/**
 * Real Apify adapter. The actor's input/output contract varies per actor, so
 * both mapping functions are supplied by the caller rather than guessed here
 * — hardcoding a fabricated field mapping would silently corrupt data once
 * pointed at a real actor. Requires APIFY_TOKEN (see .env.example); falls
 * back to MockLeadProvider when absent.
 */
export class ApifyLeadProvider implements LeadProvider {
  readonly name = 'apify';

  constructor(private readonly options: ApifyLeadProviderOptions) {}

  async discoverAccounts(params: DiscoverAccountsParams): Promise<DiscoveredAccountCandidate[]> {
    const baseUrl = this.options.baseUrl ?? 'https://api.apify.com';
    const url = `${baseUrl}/v2/acts/${encodeURIComponent(this.options.actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(this.options.apiToken)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.options.buildActorInput(params)),
    });

    if (!response.ok) {
      throw new Error(`Apify actor "${this.options.actorId}" run failed: ${response.status} ${response.statusText}`);
    }

    const items = (await response.json()) as Record<string, unknown>[];
    return items
      .map((item) => this.options.mapDatasetItem(item))
      .filter((candidate): candidate is DiscoveredAccountCandidate => candidate !== null)
      .slice(0, params.limit);
  }
}
