export type HubSpotObjectType = 'COMPANY' | 'CONTACT' | 'DEAL';

export interface HubSpotUpsertInput {
  objectType: HubSpotObjectType;
  /** Known hubspotId, or null to create a new record. */
  externalId: string | null;
  fields: Record<string, unknown>;
}

export interface HubSpotUpsertResult {
  externalId: string;
  operation: 'CREATE' | 'UPDATE';
}

export interface HubSpotAdapter {
  readonly name: string;
  upsert(input: HubSpotUpsertInput): Promise<HubSpotUpsertResult>;
  getRecord(objectType: HubSpotObjectType, externalId: string): Promise<Record<string, unknown> | null>;
}
