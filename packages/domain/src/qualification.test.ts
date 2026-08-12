import { describe, expect, it } from 'vitest';
import { determineIsSql, type QualificationCriteria } from './qualification';

const QUALIFIED: QualificationCriteria = {
  fit: true,
  relevantPerson: true,
  need: 'Accessibility remediation before a public tender deadline',
  scope: { domains: 4, channels: ['web'], description: 'Public-facing portal' },
  engagement: 'positive',
  blockers: [],
};

describe('determineIsSql', () => {
  it('is SQL when every criterion is met', () => {
    expect(determineIsSql(QUALIFIED)).toEqual({ isSql: true, unmetCriteria: [] });
  });

  it('a fixture with a missing need is never SQL, regardless of everything else being positive', () => {
    const result = determineIsSql({ ...QUALIFIED, need: null });
    expect(result.isSql).toBe(false);
    expect(result.unmetCriteria).toContain('MISSING_NEED');
  });

  it('is not SQL when fit is false', () => {
    expect(determineIsSql({ ...QUALIFIED, fit: false }).unmetCriteria).toContain('NOT_A_FIT');
  });

  it('is not SQL when the contact is not the relevant person', () => {
    expect(determineIsSql({ ...QUALIFIED, relevantPerson: false }).unmetCriteria).toContain('NOT_RELEVANT_PERSON');
  });

  it('is not SQL when scope has no domains, channels, or description', () => {
    const result = determineIsSql({ ...QUALIFIED, scope: { channels: [] } });
    expect(result.unmetCriteria).toContain('MISSING_SCOPE');
  });

  it('accepts scope backed only by a description', () => {
    const result = determineIsSql({ ...QUALIFIED, scope: { channels: [], description: 'Redesigning checkout' } });
    expect(result.unmetCriteria).not.toContain('MISSING_SCOPE');
  });

  it.each(['none', 'neutral'] as const)('is not SQL when engagement is %s', (engagement) => {
    expect(determineIsSql({ ...QUALIFIED, engagement }).unmetCriteria).toContain('ENGAGEMENT_NOT_POSITIVE');
  });

  it.each(['positive', 'high'] as const)('accepts engagement level %s', (engagement) => {
    expect(determineIsSql({ ...QUALIFIED, engagement }).unmetCriteria).not.toContain('ENGAGEMENT_NOT_POSITIVE');
  });

  it('is not SQL when there are any blockers', () => {
    expect(determineIsSql({ ...QUALIFIED, blockers: ['Budget frozen until Q3'] }).unmetCriteria).toContain('HAS_BLOCKERS');
  });

  it('reports every unmet criterion at once, not just the first', () => {
    const result = determineIsSql({
      fit: false,
      relevantPerson: false,
      need: null,
      scope: { channels: [] },
      engagement: 'none',
      blockers: ['x'],
    });
    expect(result.isSql).toBe(false);
    expect(result.unmetCriteria).toEqual([
      'NOT_A_FIT',
      'NOT_RELEVANT_PERSON',
      'MISSING_NEED',
      'MISSING_SCOPE',
      'ENGAGEMENT_NOT_POSITIVE',
      'HAS_BLOCKERS',
    ]);
  });
});
