import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  createUser,
  hashPassword,
  recordLogin,
  upsertUserByEmail,
  verifyPassword,
  verifyUserCredentials,
} from './user-service';

function createMockPrisma() {
  const user = { create: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() };
  return { prisma: { user } as unknown as PrismaClient, user };
}

describe('hashPassword / verifyPassword', () => {
  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('rejects a malformed stored hash', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-stored-hash')).toBe(false);
  });
});

describe('createUser', () => {
  it('lowercases the email and never stores the plaintext password', async () => {
    const { prisma, user } = createMockPrisma();
    user.create.mockResolvedValue({ id: 'user-1' });

    await createUser(prisma, { email: 'Jane@Acme.com', name: 'Jane Doe', password: 'hunter2', role: 'ADMIN' });

    const call = user.create.mock.calls[0]?.[0];
    expect(call.data.email).toBe('jane@acme.com');
    expect(call.data.passwordHash).not.toBe('hunter2');
    expect(call.data.passwordHash).toContain(':');
  });
});

describe('upsertUserByEmail', () => {
  it('upserts by lowercased email with a fresh password hash', async () => {
    const { prisma, user } = createMockPrisma();
    user.upsert.mockResolvedValue({ id: 'user-1' });

    await upsertUserByEmail(prisma, { email: 'Admin@Acme.com', name: 'Admin', password: 'x', role: 'ADMIN' });

    const call = user.upsert.mock.calls[0]?.[0];
    expect(call.where).toEqual({ email: 'admin@acme.com' });
    expect(call.update).toMatchObject({ name: 'Admin', role: 'ADMIN', active: true });
    expect(call.create).toMatchObject({ email: 'admin@acme.com', name: 'Admin', role: 'ADMIN' });
  });
});

describe('verifyUserCredentials', () => {
  it('returns null for an unknown email without hashing anything', async () => {
    const { prisma, user } = createMockPrisma();
    user.findUnique.mockResolvedValue(null);

    expect(await verifyUserCredentials(prisma, 'ghost@acme.com', 'x')).toBeNull();
  });

  it('returns null for a deactivated user even with the correct password', async () => {
    const { prisma, user } = createMockPrisma();
    const passwordHash = await hashPassword('correct-password');
    user.findUnique.mockResolvedValue({ id: 'user-1', active: false, passwordHash });

    expect(await verifyUserCredentials(prisma, 'jane@acme.com', 'correct-password')).toBeNull();
  });

  it('returns null for an incorrect password', async () => {
    const { prisma, user } = createMockPrisma();
    const passwordHash = await hashPassword('correct-password');
    user.findUnique.mockResolvedValue({ id: 'user-1', active: true, passwordHash });

    expect(await verifyUserCredentials(prisma, 'jane@acme.com', 'wrong-password')).toBeNull();
  });

  it('returns the user for correct credentials on an active account', async () => {
    const { prisma, user } = createMockPrisma();
    const passwordHash = await hashPassword('correct-password');
    const stored = { id: 'user-1', active: true, passwordHash };
    user.findUnique.mockResolvedValue(stored);

    expect(await verifyUserCredentials(prisma, 'jane@acme.com', 'correct-password')).toBe(stored);
  });

  it('looks up by lowercased email', async () => {
    const { prisma, user } = createMockPrisma();
    user.findUnique.mockResolvedValue(null);

    await verifyUserCredentials(prisma, 'Jane@ACME.com', 'x');

    expect(user.findUnique).toHaveBeenCalledWith({ where: { email: 'jane@acme.com' } });
  });
});

describe('recordLogin', () => {
  it('sets lastLoginAt on the user', async () => {
    const { prisma, user } = createMockPrisma();
    user.update.mockResolvedValue({});

    await recordLogin(prisma, 'user-1');

    expect(user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { lastLoginAt: expect.any(Date) } });
  });
});
