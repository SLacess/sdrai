import type { AIProvider, ProviderCompleteRequest, ProviderRawResponse } from './types';

export type StubResponder = (request: ProviderCompleteRequest) => Promise<ProviderRawResponse> | ProviderRawResponse;

/**
 * Deterministic provider for tests and for local development when no
 * AI_API_KEY_PRIMARY is configured (see .env.example). Never calls a network.
 */
export class StubProvider implements AIProvider {
  readonly name: string;

  constructor(
    private readonly responder: StubResponder,
    name = 'stub',
  ) {
    this.name = name;
  }

  async complete(request: ProviderCompleteRequest): Promise<ProviderRawResponse> {
    return this.responder(request);
  }
}
