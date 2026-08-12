import type { z } from 'zod';
import { estimateCostMicrosUsd, type PricingTable } from './pricing';
import { withTimeout } from './timeout';
import {
  AIGatewayError,
  SchemaValidationError,
  type AgentInvokeRequest,
  type AgentInvokeResult,
  type AIProvider,
  type ProviderRawResponse,
} from './types';

export interface AIGatewayOptions {
  primary: AIProvider;
  fallback?: AIProvider;
  timeoutMs?: number;
  maxRetries?: number;
  pricing?: PricingTable;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.2;

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Provider-neutral entry point for calling an LLM. Every result carries
 * model/latency/token/cost metadata so callers can persist it onto AgentRun
 * (CLAUDE.md observability rules), and every output is Zod-validated before
 * being handed back — an agent output that fails schema validation is
 * retried like any other transient failure, then surfaced as a hard error.
 * It never executes side effects itself; that stays with the Policy Engine.
 */
export class AIGateway {
  constructor(private readonly options: AIGatewayOptions) {}

  async invoke<TSchema extends z.ZodTypeAny>(
    request: AgentInvokeRequest<TSchema>,
  ): Promise<AgentInvokeResult<z.infer<TSchema>>> {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = this.options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const pricing = this.options.pricing ?? {};

    let lastError: unknown;
    let attemptsOnPrimary = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attemptsOnPrimary = attempt + 1;
      const startedAt = Date.now();
      try {
        const { raw, data } = await this.attempt(this.options.primary, request, timeoutMs);
        return this.buildResult(raw, data, this.options.primary.name, attempt, false, pricing, Date.now() - startedAt);
      } catch (error) {
        lastError = error;
      }
    }

    if (this.options.fallback) {
      const startedAt = Date.now();
      try {
        const { raw, data } = await this.attempt(this.options.fallback, request, timeoutMs);
        return this.buildResult(
          raw,
          data,
          this.options.fallback.name,
          attemptsOnPrimary - 1,
          true,
          pricing,
          Date.now() - startedAt,
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw new AIGatewayError(
      `AI gateway exhausted ${this.options.fallback ? 'primary and fallback providers' : 'the primary provider'} for agent "${request.agent}"`,
      lastError,
    );
  }

  private async attempt<TSchema extends z.ZodTypeAny>(
    provider: AIProvider,
    request: AgentInvokeRequest<TSchema>,
    timeoutMs: number,
  ): Promise<{ raw: ProviderRawResponse; data: z.infer<TSchema> }> {
    const raw = await withTimeout(
      provider.complete({
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        maxTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: request.temperature ?? DEFAULT_TEMPERATURE,
      }),
      timeoutMs,
      `Provider "${provider.name}" timed out after ${timeoutMs}ms for agent "${request.agent}"`,
    );

    const parsed = request.schema.safeParse(safeJsonParse(raw.text));
    if (!parsed.success) throw new SchemaValidationError(provider.name, parsed.error.issues);
    return { raw, data: parsed.data };
  }

  private buildResult<T>(
    raw: ProviderRawResponse,
    data: T,
    providerName: string,
    retries: number,
    usedFallback: boolean,
    pricing: PricingTable,
    latencyMs: number,
  ): AgentInvokeResult<T> {
    return {
      output: data,
      provider: providerName,
      model: raw.model,
      latencyMs,
      tokensInput: raw.tokensInput,
      tokensOutput: raw.tokensOutput,
      estimatedCostMicrosUsd: estimateCostMicrosUsd(pricing, raw.model, raw.tokensInput, raw.tokensOutput),
      retries,
      usedFallback,
    };
  }
}
