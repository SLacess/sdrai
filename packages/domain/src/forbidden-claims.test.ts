import { describe, expect, it } from 'vitest';
import { DEFAULT_FORBIDDEN_CLAIMS, findForbiddenClaim } from './forbidden-claims';

describe('findForbiddenClaim', () => {
  it('returns null when no forbidden phrase is present', () => {
    expect(findForbiddenClaim('We can help improve your accessibility posture.', DEFAULT_FORBIDDEN_CLAIMS)).toBeNull();
  });

  it('detects a forbidden phrase case-insensitively', () => {
    expect(findForbiddenClaim('Our platform makes your site 100% ACCESSIBLE', DEFAULT_FORBIDDEN_CLAIMS)).toBe(
      '100% accessible',
    );
  });

  it('detects the Portuguese banned phrase from CLAUDE.md rule 13', () => {
    expect(findForbiddenClaim('Seu site viola a lei atualmente.', DEFAULT_FORBIDDEN_CLAIMS)).toBe('seu site viola a lei');
  });

  it('detects a phrase embedded mid-sentence, not just as a standalone match', () => {
    expect(findForbiddenClaim('Com nossa solução, garantimos compliance total.', DEFAULT_FORBIDDEN_CLAIMS)).toBe(
      'garantimos compliance',
    );
  });

  it('respects a custom forbidden-phrase list over the defaults', () => {
    expect(findForbiddenClaim('This is fully certified.', ['fully certified'])).toBe('fully certified');
    expect(findForbiddenClaim('100% accessible', ['fully certified'])).toBeNull();
  });
});
