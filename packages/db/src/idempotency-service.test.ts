import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { completeIdempotencyKey, computeRequestHash, reserveIdempotencyKey } from './idempotency-service';

function createMockPrisma() {
  const idempotencyRecord = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
  return { prisma: { idempotencyRecord } as unknown as PrismaClient, idempotencyRecord };
}

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

describe('computeRequestHash', () => {
  it('is deterministic for the same payload', () => {
    expect(computeRequestHash({ a: 1, b: 2 })).toBe(computeRequestHash({ a: 1, b: 2 }));
  });

  it('differs for different payloads', () => {
    expect(computeRequestHash({ a: 1 })).not.toBe(computeRequestHash({ a: 2 }));
  });
});

describe('reserveIdempotencyKey', () => {
  it('reserves a brand-new key', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue(null);
    idempotencyRecord.create.mockResolvedValue({});

    const result = await reserveIdempotencyKey(prisma, { key: 'key-1', action: 'send_touchpoint', requestHash: 'h1' });

    expect(result).toEqual({ kind: 'RESERVED' });
    expect(idempotencyRecord.create).toHaveBeenCalledWith({
      data: { key: 'key-1', action: 'send_touchpoint', requestHash: 'h1', status: 'IN_PROGRESS' },
    });
  });

  it('sets expiresAt from ttlMs when provided', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue(null);
    idempotencyRecord.create.mockResolvedValue({});
    const before = Date.now();

    await reserveIdempotencyKey(prisma, { key: 'key-1', action: 'a', requestHash: 'h1', ttlMs: 60_000 });

    const call = idempotencyRecord.create.mock.calls[0]?.[0];
    const expiresAt: Date = call.data.expiresAt;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(expiresAt.getTime()).toBeLessThan(before + 61_000);
  });

  it('returns DUPLICATE with the stored response for a completed request with the same hash', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: 'h1',
      status: 'COMPLETED',
      responseJson: { ok: true },
    });

    const result = await reserveIdempotencyKey(prisma, { key: 'key-1', action: 'a', requestHash: 'h1' });
    expect(result).toEqual({ kind: 'DUPLICATE', responseJson: { ok: true } });
    expect(idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('returns DUPLICATE with a null response for an in-flight request with the same hash', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue({ requestHash: 'h1', status: 'IN_PROGRESS', responseJson: null });

    const result = await reserveIdempotencyKey(prisma, { key: 'key-1', action: 'a', requestHash: 'h1' });
    expect(result).toEqual({ kind: 'DUPLICATE', responseJson: null });
  });

  it('returns CONFLICT when the same key is reused with a different request payload', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue({ requestHash: 'h1', status: 'COMPLETED', responseJson: {} });

    const result = await reserveIdempotencyKey(prisma, { key: 'key-1', action: 'a', requestHash: 'DIFFERENT' });
    expect(result).toEqual({ kind: 'CONFLICT' });
  });

  it('resolves a create-time race (lost the insert race) as DUPLICATE when the hash matches', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValueOnce(null);
    idempotencyRecord.create.mockRejectedValueOnce(uniqueConstraintError());
    idempotencyRecord.findUnique.mockResolvedValueOnce({ requestHash: 'h1', status: 'IN_PROGRESS', responseJson: null });

    const result = await reserveIdempotencyKey(prisma, { key: 'key-1', action: 'a', requestHash: 'h1' });
    expect(result).toEqual({ kind: 'DUPLICATE', responseJson: null });
  });

  it('resolves a create-time race as CONFLICT when the winner used a different payload', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValueOnce(null);
    idempotencyRecord.create.mockRejectedValueOnce(uniqueConstraintError());
    idempotencyRecord.findUnique.mockResolvedValueOnce({ requestHash: 'OTHER', status: 'IN_PROGRESS', responseJson: null });

    const result = await reserveIdempotencyKey(prisma, { key: 'key-1', action: 'a', requestHash: 'h1' });
    expect(result).toEqual({ kind: 'CONFLICT' });
  });

  it('rethrows non-unique-constraint errors from create', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.findUnique.mockResolvedValue(null);
    idempotencyRecord.create.mockRejectedValue(new Error('db is down'));

    await expect(reserveIdempotencyKey(prisma, { key: 'key-1', action: 'a', requestHash: 'h1' })).rejects.toThrow(
      'db is down',
    );
  });
});

describe('completeIdempotencyKey', () => {
  it('marks the record COMPLETED with the response payload', async () => {
    const { prisma, idempotencyRecord } = createMockPrisma();
    idempotencyRecord.update.mockResolvedValue({});

    await completeIdempotencyKey(prisma, 'key-1', { sent: true });

    expect(idempotencyRecord.update).toHaveBeenCalledWith({
      where: { key: 'key-1' },
      data: { status: 'COMPLETED', responseJson: { sent: true } },
    });
  });
});
