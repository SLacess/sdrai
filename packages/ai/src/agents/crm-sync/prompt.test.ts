import { describe, expect, it } from 'vitest';
import { buildCrmSyncPrompt } from './prompt';

describe('buildCrmSyncPrompt', () => {
  it('lists the authoritative fields per object', () => {
    const prompt = buildCrmSyncPrompt({
      records: [],
      authoritativeFieldsByObject: { COMPANY: ['ownerId'], DEAL: ['dealamount', 'closedate'] },
    });
    expect(prompt).toContain('- COMPANY: ownerId');
    expect(prompt).toContain('- DEAL: dealamount, closedate');
  });

  it('shows "(none)" for an object with no authoritative fields', () => {
    const prompt = buildCrmSyncPrompt({ records: [], authoritativeFieldsByObject: { CONTACT: [] } });
    expect(prompt).toContain('- CONTACT: (none)');
  });

  it('includes each record with its local and hubspot field snapshots', () => {
    const prompt = buildCrmSyncPrompt({
      records: [
        {
          object: 'COMPANY',
          externalId: 'hs-1',
          localFields: { name: 'Acme' },
          hubspotFields: { name: 'Acme Old', ownerId: 'rep-1' },
        },
      ],
      authoritativeFieldsByObject: { COMPANY: ['ownerId'] },
    });
    expect(prompt).toContain('object=COMPANY externalId=hs-1');
    expect(prompt).toContain('"name":"Acme"');
    expect(prompt).toContain('"ownerId":"rep-1"');
  });

  it('marks a record with no HubSpot match as not found, and a new record as (new)', () => {
    const prompt = buildCrmSyncPrompt({
      records: [{ object: 'CONTACT', externalId: null, localFields: { email: 'jane@acme.com' }, hubspotFields: null }],
      authoritativeFieldsByObject: {},
    });
    expect(prompt).toContain('externalId=(new)');
    expect(prompt).toContain('hubspot=(not found)');
  });
});
