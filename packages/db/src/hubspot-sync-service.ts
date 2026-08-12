import type { PrismaClient } from '@prisma/client';
import { applyFieldPrecedence } from '@sinal/domain';

export interface CrmAdapter {
  upsert(input: {
    objectType: 'COMPANY' | 'CONTACT' | 'DEAL';
    externalId: string | null;
    fields: Record<string, unknown>;
  }): Promise<{ externalId: string; operation: 'CREATE' | 'UPDATE' }>;
}

export interface SyncAccountToHubSpotParams {
  accountId: string;
  fields: Record<string, unknown>;
  authoritativeFields?: readonly string[];
}

export interface SyncAccountToHubSpotResult {
  externalId: string;
  operation: 'CREATE' | 'UPDATE';
  skippedFields: string[];
}

/**
 * Every outgoing field is filtered through applyFieldPrecedence before the
 * adapter ever sees it — a manually authoritative HubSpot field is never
 * part of the upsert payload, so it cannot be overwritten (BP-028).
 */
export async function syncAccountToHubSpot(
  prisma: PrismaClient,
  adapter: CrmAdapter,
  params: SyncAccountToHubSpotParams,
): Promise<SyncAccountToHubSpotResult> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: params.accountId } });

  const { fields, skippedFields } = applyFieldPrecedence(params.fields, {
    authoritativeFields: params.authoritativeFields ?? [],
  });

  const result = await adapter.upsert({ objectType: 'COMPANY', externalId: account.hubspotId, fields });

  if (account.hubspotId !== result.externalId) {
    await prisma.account.update({ where: { id: account.id }, data: { hubspotId: result.externalId } });
  }

  return { externalId: result.externalId, operation: result.operation, skippedFields };
}
