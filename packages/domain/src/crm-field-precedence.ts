export interface FieldPrecedenceConfig {
  /** Field names a human maintains manually in the CRM — sync must never touch them. */
  authoritativeFields: readonly string[];
}

export interface ApplyFieldPrecedenceResult {
  fields: Record<string, unknown>;
  skippedFields: string[];
}

/**
 * The entire "manual authoritative field remains unchanged" guarantee: any
 * field named in the authoritative list is stripped from the outgoing
 * payload before it's ever sent to the CRM, so the field's current
 * human-set value can never be overwritten by sync — structurally, not by
 * hoping the CRM API respects a flag.
 */
export function applyFieldPrecedence(
  proposedFields: Readonly<Record<string, unknown>>,
  config: FieldPrecedenceConfig,
): ApplyFieldPrecedenceResult {
  const fields: Record<string, unknown> = {};
  const skippedFields: string[] = [];

  for (const [key, value] of Object.entries(proposedFields)) {
    if (config.authoritativeFields.includes(key)) {
      skippedFields.push(key);
      continue;
    }
    fields[key] = value;
  }

  return { fields, skippedFields };
}
