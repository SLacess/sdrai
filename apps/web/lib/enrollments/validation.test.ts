import { describe, expect, it } from 'vitest';
import { EnrollmentRequestSchema } from './validation';

describe('EnrollmentRequestSchema', () => {
  it('accepts valid uuids for campaignId and contactId', () => {
    const result = EnrollmentRequestSchema.safeParse({
      campaignId: '11111111-1111-4111-8111-111111111111',
      contactId: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid campaignId', () => {
    const result = EnrollmentRequestSchema.safeParse({ campaignId: 'not-a-uuid', contactId: '22222222-2222-4222-8222-222222222222' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing contactId', () => {
    const result = EnrollmentRequestSchema.safeParse({ campaignId: '11111111-1111-4111-8111-111111111111' });
    expect(result.success).toBe(false);
  });
});
