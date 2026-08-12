import { describe, expect, it } from 'vitest';
import { isValidTimezone } from './timezone';

describe('isValidTimezone', () => {
  it.each(['America/Sao_Paulo', 'UTC', 'Europe/Lisbon', 'Asia/Tokyo', 'America/New_York'])(
    'accepts the valid IANA timezone %s',
    (timezone) => {
      expect(isValidTimezone(timezone)).toBe(true);
    },
  );

  it.each(['Not/A_Zone', 'GMT+5', '', 'america/sao_paulo!'])(
    'rejects the invalid timezone "%s"',
    (timezone) => {
      expect(isValidTimezone(timezone)).toBe(false);
    },
  );
});
