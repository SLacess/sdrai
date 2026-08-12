import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PrismaClient, User, UserRole } from '@prisma/client';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** scrypt is a memory-hard KDF built into Node — no extra dependency, no native bindings. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(hashHex, 'hex');
  if (storedBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(derivedKey, storedBuffer);
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export async function createUser(prisma: PrismaClient, input: CreateUserInput): Promise<User> {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: { email: input.email.toLowerCase(), name: input.name, passwordHash, role: input.role },
  });
}

/** Idempotent create/update by email — used by the bootstrap admin seed script. */
export async function upsertUserByEmail(prisma: PrismaClient, input: CreateUserInput): Promise<User> {
  const passwordHash = await hashPassword(input.password);
  const email = input.email.toLowerCase();
  return prisma.user.upsert({
    where: { email },
    update: { name: input.name, passwordHash, role: input.role, active: true },
    create: { email, name: input.name, passwordHash, role: input.role },
  });
}

/** Returns null for unknown email, wrong password, or a deactivated user — never distinguishes which. */
export async function verifyUserCredentials(prisma: PrismaClient, email: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export async function recordLogin(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}
