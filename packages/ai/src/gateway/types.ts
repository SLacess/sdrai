import type { z } from 'zod';

export interface ProviderCompleteRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

export interface ProviderRawResponse {
  text: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
}

export interface AIProvider {
  readonly name: string;
  complete(request: ProviderCompleteRequest): Promise<ProviderRawResponse>;
}

export interface AgentInvokeRequest<TSchema extends z.ZodTypeAny> {
  agent: string;
  agentVersion: string;
  systemPrompt: string;
  userPrompt: string;
  schema: TSchema;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentInvokeResult<T> {
  output: T;
  provider: string;
  model: string;
  latencyMs: number;
  tokensInput: number;
  tokensOutput: number;
  estimatedCostMicrosUsd: number | null;
  retries: number;
  usedFallback: boolean;
}

export class ProviderTimeoutError extends Error {}

export class SchemaValidationError extends Error {
  constructor(
    public provider: string,
    public issues: z.ZodIssue[],
  ) {
    super(`${provider} response failed schema validation: ${JSON.stringify(issues)}`);
  }
}

export class AIGatewayError extends Error {
  constructor(
    message: string,
    public cause: unknown,
  ) {
    super(message);
  }
}
