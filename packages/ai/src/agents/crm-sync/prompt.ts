export interface CrmSyncRecordSummary {
  object: string;
  externalId: string | null;
  localFields: Record<string, unknown>;
  hubspotFields: Record<string, unknown> | null;
}

export interface CrmSyncPromptInput {
  records: readonly CrmSyncRecordSummary[];
  authoritativeFieldsByObject: Readonly<Record<string, readonly string[]>>;
}

/**
 * Both sides of the diff (our local record and the current HubSpot record)
 * are our own retrieved data, not third-party scraped content, so this
 * prompt has no untrusted-content section — the agent just needs to know
 * which field names it may never propose changing.
 */
export function buildCrmSyncPrompt(input: CrmSyncPromptInput): string {
  const authoritativeLines = Object.entries(input.authoritativeFieldsByObject).map(
    ([object, fields]) => `- ${object}: ${fields.length > 0 ? fields.join(', ') : '(none)'}`,
  );

  const recordLines = input.records.map(
    (record) =>
      `- object=${record.object} externalId=${record.externalId ?? '(new)'}\n` +
      `  local=${JSON.stringify(record.localFields)}\n` +
      `  hubspot=${record.hubspotFields ? JSON.stringify(record.hubspotFields) : '(not found)'}`,
  );

  return [
    'TRUSTED INTERNAL CONTEXT:',
    'Authoritative fields per object (never propose changing these; if the local and HubSpot values',
    'differ on one of them, set operation=CONFLICT and list it in authoritativeConflicts):',
    ...authoritativeLines,
    '',
    'Records to reconcile:',
    ...recordLines,
  ].join('\n');
}
