import { describe, expect, it } from 'vitest';
import { CreateCampaignRequestSchema } from './validation';

const VALID = {
  name: 'Q3 Accessibility Push',
  icp: { sector: 'Retail' },
  offer: { product: 'Accessibility Audit' },
  channels: ['EMAIL', 'LINKEDIN'],
  guardrails: { maxPerDay: 50 },
  frequencyCaps: { perContactPerWeek: 2 },
};

describe('CreateCampaignRequestSchema', () => {
  it('accepts a valid request without language (defaults handled downstream)', () => {
    expect(CreateCampaignRequestSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts an explicit valid language', () => {
    expect(CreateCampaignRequestSchema.safeParse({ ...VALID, language: 'es' }).success).toBe(true);
  });

  it('rejects an unknown channel', () => {
    const result = CreateCampaignRequestSchema.safeParse({ ...VALID, channels: ['SMS'] });
    expect(result.success).toBe(false);
  });

  it('rejects an empty channels array', () => {
    const result = CreateCampaignRequestSchema.safeParse({ ...VALID, channels: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported language', () => {
    const result = CreateCampaignRequestSchema.safeParse({ ...VALID, language: 'fr' });
    expect(result.success).toBe(false);
  });

  it.each(['name', 'icp', 'offer', 'channels', 'guardrails', 'frequencyCaps'])(
    'rejects a request missing required field "%s"',
    (field) => {
      const { [field]: _omitted, ...withoutField } = VALID as Record<string, unknown>;
      expect(CreateCampaignRequestSchema.safeParse(withoutField).success).toBe(false);
    },
  );

  it('rejects an empty name', () => {
    expect(CreateCampaignRequestSchema.safeParse({ ...VALID, name: '' }).success).toBe(false);
  });
});
