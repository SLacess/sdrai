import type { DiscoverAccountsParams, DiscoveredAccountCandidate, LeadProvider } from './types';

const FIXTURE_CANDIDATES: DiscoveredAccountCandidate[] = [
  { brandName: 'Aurora Varejo', domain: 'aurora-varejo.example.com', country: 'BR', sector: 'Retail', sourceUris: ['https://aurora-varejo.example.com'] },
  { brandName: 'Norte Bancário', domain: 'norte-bancario.example.com', country: 'BR', sector: 'Financial Services', sourceUris: ['https://norte-bancario.example.com'] },
  { brandName: 'Vetta Educação', domain: 'vetta-educacao.example.com', country: 'BR', sector: 'Education', sourceUris: ['https://vetta-educacao.example.com'] },
];

/**
 * Deterministic stand-in for a real discovery provider. Used whenever no
 * external credential (e.g. APIFY_TOKEN) is configured, so the vertical
 * slice stays functional without live integrations (CLAUDE.md rule 25).
 */
export class MockLeadProvider implements LeadProvider {
  readonly name = 'mock';

  async discoverAccounts(params: DiscoverAccountsParams): Promise<DiscoveredAccountCandidate[]> {
    return FIXTURE_CANDIDATES.slice(0, Math.max(0, Math.min(params.limit, FIXTURE_CANDIDATES.length)));
  }
}
