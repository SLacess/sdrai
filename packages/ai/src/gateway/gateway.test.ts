import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AIGateway } from './gateway';
import { StubProvider } from './stub-provider';
import { AIGatewayError, ProviderTimeoutError, type ProviderRawResponse } from './types';

const OutputSchema = z.object({ ok: z.boolean(), value: z.string() });

const GOOD_RESPONSE: ProviderRawResponse = {
  text: JSON.stringify({ ok: true, value: 'hello' }),
  model: 'claude-sonnet-5',
  tokensInput: 100,
  tokensOutput: 20,
};

function baseRequest() {
  return {
    agent: 'test_agent',
    agentVersion: '1.0.0',
    systemPrompt: 'system',
    userPrompt: 'user',
    schema: OutputSchema,
  };
}

function flakyProvider(name: string, failCount: number, response: ProviderRawResponse) {
  let calls = 0;
  return new StubProvider(async () => {
    calls += 1;
    if (calls <= failCount) throw new Error(`transient failure #${calls} from ${name}`);
    return response;
  }, name);
}

function alwaysFailingProvider(name: string) {
  return new StubProvider(async () => {
    throw new Error(`${name} is down`);
  }, name);
}

describe('AIGateway.invoke', () => {
  it('returns the parsed output with provider/model/token metadata on a first-try success', async () => {
    const gateway = new AIGateway({ primary: new StubProvider(async () => GOOD_RESPONSE, 'primary') });
    const result = await gateway.invoke(baseRequest());

    expect(result.output).toEqual({ ok: true, value: 'hello' });
    expect(result.provider).toBe('primary');
    expect(result.model).toBe('claude-sonnet-5');
    expect(result.tokensInput).toBe(100);
    expect(result.tokensOutput).toBe(20);
    expect(result.retries).toBe(0);
    expect(result.usedFallback).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns null estimatedCostMicrosUsd when no pricing table is configured', async () => {
    const gateway = new AIGateway({ primary: new StubProvider(async () => GOOD_RESPONSE, 'primary') });
    const result = await gateway.invoke(baseRequest());
    expect(result.estimatedCostMicrosUsd).toBeNull();
  });

  it('computes estimatedCostMicrosUsd when a pricing table is configured', async () => {
    const gateway = new AIGateway({
      primary: new StubProvider(async () => GOOD_RESPONSE, 'primary'),
      pricing: { 'claude-sonnet-5': { inputPerMillionUsd: 3, outputPerMillionUsd: 15 } },
    });
    const result = await gateway.invoke(baseRequest());
    // 100 in @ $3/M + 20 out @ $15/M = 0.0003 + 0.0003 = $0.0006 -> 600 micros
    expect(result.estimatedCostMicrosUsd).toBe(600);
  });

  it('retries the primary provider on transient failure and succeeds without a fallback', async () => {
    const gateway = new AIGateway({
      primary: flakyProvider('primary', 1, GOOD_RESPONSE),
      maxRetries: 2,
    });
    const result = await gateway.invoke(baseRequest());
    expect(result.provider).toBe('primary');
    expect(result.retries).toBe(1);
    expect(result.usedFallback).toBe(false);
  });

  it('treats a schema-invalid response as a retryable failure', async () => {
    let calls = 0;
    const provider = new StubProvider(async () => {
      calls += 1;
      if (calls === 1) return { ...GOOD_RESPONSE, text: JSON.stringify({ ok: 'not-a-boolean' }) };
      return GOOD_RESPONSE;
    }, 'primary');
    const gateway = new AIGateway({ primary: provider, maxRetries: 1 });

    const result = await gateway.invoke(baseRequest());
    expect(result.output).toEqual({ ok: true, value: 'hello' });
    expect(result.retries).toBe(1);
  });

  it('falls back to the secondary provider once the primary exhausts its retries', async () => {
    const gateway = new AIGateway({
      primary: alwaysFailingProvider('primary'),
      fallback: new StubProvider(async () => GOOD_RESPONSE, 'fallback'),
      maxRetries: 1,
    });

    const result = await gateway.invoke(baseRequest());
    expect(result.provider).toBe('fallback');
    expect(result.usedFallback).toBe(true);
  });

  it('throws AIGatewayError with the last error as cause when both providers exhaust', async () => {
    const gateway = new AIGateway({
      primary: alwaysFailingProvider('primary'),
      fallback: alwaysFailingProvider('fallback'),
      maxRetries: 0,
    });

    await expect(gateway.invoke(baseRequest())).rejects.toBeInstanceOf(AIGatewayError);
    try {
      await gateway.invoke(baseRequest());
      throw new Error('expected invoke to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(AIGatewayError);
      expect((error as AIGatewayError).cause).toBeInstanceOf(Error);
      expect(((error as AIGatewayError).cause as Error).message).toContain('fallback is down');
    }
  });

  it('throws immediately after a single failed attempt when maxRetries is 0 and there is no fallback', async () => {
    const provider = alwaysFailingProvider('primary');
    const gateway = new AIGateway({ primary: provider, maxRetries: 0 });
    await expect(gateway.invoke(baseRequest())).rejects.toBeInstanceOf(AIGatewayError);
  });

  describe('timeouts (fake timers — no real-clock race with the provider delay)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('treats a provider that never resolves in time as a timeout and falls back', async () => {
      const hangingProvider = new StubProvider(
        () => new Promise<ProviderRawResponse>((resolve) => setTimeout(() => resolve(GOOD_RESPONSE), 50)),
        'primary',
      );
      const gateway = new AIGateway({
        primary: hangingProvider,
        fallback: new StubProvider(async () => GOOD_RESPONSE, 'fallback'),
        timeoutMs: 10,
        maxRetries: 0,
      });

      const resultPromise = gateway.invoke(baseRequest());
      await vi.advanceTimersByTimeAsync(10);
      const result = await resultPromise;
      expect(result.usedFallback).toBe(true);
    });

    it('surfaces ProviderTimeoutError as the cause when every provider times out', async () => {
      const hangingProvider = new StubProvider(
        () => new Promise<ProviderRawResponse>((resolve) => setTimeout(() => resolve(GOOD_RESPONSE), 50)),
      );
      const gateway = new AIGateway({ primary: hangingProvider, timeoutMs: 10, maxRetries: 0 });

      const assertion = expect(gateway.invoke(baseRequest())).rejects.toBeInstanceOf(AIGatewayError);
      await vi.advanceTimersByTimeAsync(10);
      await assertion;

      const rejection = gateway.invoke(baseRequest()).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10);
      const error = await rejection;
      expect((error as AIGatewayError).cause).toBeInstanceOf(ProviderTimeoutError);
    });
  });
});
