import { PrismaClient } from '@prisma/client';

declare global {
  var __sinalPrisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalThis.__sinalPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sinalPrisma = prisma;
}
