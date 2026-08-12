/**
 * Validates an IANA timezone identifier using the runtime's own tz database
 * (via Intl), so there's no separate timezone-name dependency to keep in
 * sync — Intl.DateTimeFormat throws RangeError for anything it doesn't
 * recognize.
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
