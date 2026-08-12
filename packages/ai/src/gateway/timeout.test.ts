import { describe, expect, it } from 'vitest';
import { ProviderTimeoutError } from './types';
import { withTimeout } from './timeout';

describe('withTimeout', () => {
  it('resolves with the underlying value when it settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 50, 'timed out');
    expect(result).toBe('ok');
  });

  it('rejects with ProviderTimeoutError when the promise never settles in time', async () => {
    const neverResolves = new Promise(() => {});
    await expect(withTimeout(neverResolves, 10, 'custom timeout message')).rejects.toThrow(ProviderTimeoutError);
    await expect(withTimeout(neverResolves, 10, 'custom timeout message')).rejects.toThrow('custom timeout message');
  });

  it('propagates the underlying rejection when it fails before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50, 'timed out')).rejects.toThrow('boom');
  });
});
