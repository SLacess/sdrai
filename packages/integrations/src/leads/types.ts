export interface DiscoveredAccountCandidate {
  brandName: string;
  domain: string;
  country?: string;
  sector?: string;
  sourceUris: string[];
}

export interface DiscoverAccountsParams {
  icp?: unknown;
  limit: number;
  sourceKeys?: string[];
}

/**
 * Swappable data-source boundary for account discovery. Real implementations
 * (Apify actors, other providers) live behind this interface so the domain
 * never depends on a specific vendor (CLAUDE.md rule: no direct external
 * calls outside adapters; keep the app functional when a credential is
 * missing by falling back to MockLeadProvider).
 */
export interface LeadProvider {
  readonly name: string;
  discoverAccounts(params: DiscoverAccountsParams): Promise<DiscoveredAccountCandidate[]>;
}
