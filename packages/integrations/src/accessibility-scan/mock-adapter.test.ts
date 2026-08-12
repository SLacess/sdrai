import { describe, expect, it } from 'vitest';
import { MockAccessibilityScanAdapter } from './mock-adapter';

describe('MockAccessibilityScanAdapter', () => {
  it('returns deterministic findings with valid severities', async () => {
    const adapter = new MockAccessibilityScanAdapter();
    const findings = await adapter.scan('acme.com');
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(['info', 'low', 'medium', 'high']).toContain(finding.severity);
      expect(finding.rule.length).toBeGreaterThan(0);
      expect(finding.description.length).toBeGreaterThan(0);
    }
  });

  it('never includes a compliance/legal verdict field', async () => {
    const adapter = new MockAccessibilityScanAdapter();
    const findings = await adapter.scan('acme.com');
    for (const finding of findings) {
      expect(finding).not.toHaveProperty('compliant');
      expect(finding).not.toHaveProperty('violatesLaw');
      expect(finding).not.toHaveProperty('wcagCompliant');
    }
  });

  it('returns the same findings regardless of domain (deterministic fixture)', async () => {
    const adapter = new MockAccessibilityScanAdapter();
    expect(await adapter.scan('acme.com')).toEqual(await adapter.scan('other.com'));
  });
});
