import { describe, expect, it } from 'vitest';
import { normalizeName } from './normalize';

describe('normalizeName', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeName('Ação Ltda')).toBe('acao ltda');
  });

  it('collapses repeated whitespace and trims', () => {
    expect(normalizeName('  Aurora   Varejo  ')).toBe('aurora varejo');
  });

  it('is stable for already-normalized input', () => {
    expect(normalizeName('acme corp')).toBe('acme corp');
  });

  it('treats accented and unaccented variants as equal', () => {
    expect(normalizeName('São Paulo')).toBe(normalizeName('Sao Paulo'));
  });
});
