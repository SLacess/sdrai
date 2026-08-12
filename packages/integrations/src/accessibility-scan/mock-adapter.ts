import type { AccessibilityScanAdapter, AccessibilityScanFinding } from './types';

const FIXTURE_FINDINGS: AccessibilityScanFinding[] = [
  { rule: 'color-contrast', severity: 'medium', description: 'Low contrast text found on primary CTA buttons.', selector: 'button.cta' },
  { rule: 'image-alt', severity: 'high', description: 'Product images are missing alt text.', selector: 'img.product-photo' },
  { rule: 'label', severity: 'low', description: 'A search input has no associated label.', selector: 'input[type="search"]' },
];

/**
 * Deterministic stand-in for a real automated scanner (axe-core, WAVE, etc.).
 * Used when no scan provider credential is configured, so the pipeline stays
 * functional (CLAUDE.md rule 25).
 */
export class MockAccessibilityScanAdapter implements AccessibilityScanAdapter {
  readonly name = 'mock';

  async scan(_domain: string): Promise<AccessibilityScanFinding[]> {
    return FIXTURE_FINDINGS;
  }
}
