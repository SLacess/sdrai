import { describe, expect, it } from 'vitest';
import { createPrismaClient } from './client';

describe('createPrismaClient', () => {
  it('constructs a PrismaClient instance without connecting', () => {
    const client = createPrismaClient();
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
  });
});
