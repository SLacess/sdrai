const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/** Diacritic-insensitive, whitespace-collapsed key used for dedupe/matching (Account/Contact.normalizedName). */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
