import { applyFieldPrecedence } from '@sinal/domain';
import type { CrmAdapter } from './hubspot-sync-service';

export type CrmSyncObjectType = 'COMPANY' | 'CONTACT' | 'DEAL' | 'NOTE' | 'ACTIVITY';

export interface CrmSyncOperationInput {
  object: CrmSyncObjectType;
  operation: 'CREATE' | 'UPDATE' | 'NOOP' | 'CONFLICT';
  externalId: string | null;
  fields: Record<string, unknown>;
  authoritativeConflicts: string[];
}

export interface ReconciliationConflict {
  object: CrmSyncObjectType;
  externalId: string | null;
  reason: string;
}

export interface ReconciliationSummary {
  created: number;
  updated: number;
  skipped: number;
  conflicts: ReconciliationConflict[];
}

/**
 * A CONFLICT operation (agent-flagged or carrying any authoritativeConflicts)
 * is reported and never written — conflicts are surfaced, not auto-resolved
 * (WF-13 guardrail). Every write is an upsert keyed by externalId, so
 * re-running the same batch of UPDATEs is safe (converges to the same
 * state); a CREATE with no externalId is a one-time operation like any
 * upsert API — once persisted locally (see syncAccountToHubSpot), later
 * reconciliation runs see the externalId and use UPDATE, not CREATE.
 */
export async function applyCrmSyncOperations(
  adapter: CrmAdapter,
  operations: readonly CrmSyncOperationInput[],
  authoritativeFieldsByObject: Readonly<Record<string, readonly string[]>> = {},
): Promise<ReconciliationSummary> {
  const summary: ReconciliationSummary = { created: 0, updated: 0, skipped: 0, conflicts: [] };

  for (const op of operations) {
    if (op.operation === 'NOOP') {
      summary.skipped++;
      continue;
    }

    if (op.operation === 'CONFLICT' || op.authoritativeConflicts.length > 0) {
      summary.conflicts.push({
        object: op.object,
        externalId: op.externalId,
        reason:
          op.authoritativeConflicts.length > 0
            ? `Authoritative field conflict: ${op.authoritativeConflicts.join(', ')}`
            : 'Agent flagged a conflict',
      });
      continue;
    }

    if (op.object !== 'COMPANY' && op.object !== 'CONTACT' && op.object !== 'DEAL') {
      summary.skipped++;
      continue;
    }

    const { fields } = applyFieldPrecedence(op.fields, {
      authoritativeFields: authoritativeFieldsByObject[op.object] ?? [],
    });
    const result = await adapter.upsert({ objectType: op.object, externalId: op.externalId, fields });
    if (result.operation === 'CREATE') summary.created++;
    else summary.updated++;
  }

  return summary;
}
