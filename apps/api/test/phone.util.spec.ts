import { normalizePhone, phoneMatchCandidates } from '../src/common/phone.util';

describe('normalizePhone', () => {
  it('prepends +91 to a bare 10-digit Indian number', () => {
    expect(normalizePhone('9880141543')).toBe('+919880141543');
  });

  it('strips spaces, dashes and parens', () => {
    expect(normalizePhone('+91 98801-41543')).toBe('+919880141543');
    expect(normalizePhone('(988) 014-1543')).toBe('+919880141543');
  });

  it('drops a domestic trunk 0 before applying the country code', () => {
    expect(normalizePhone('09880141543')).toBe('+919880141543');
  });

  it('leaves an already-E.164 number unchanged', () => {
    expect(normalizePhone('+919880141543')).toBe('+919880141543');
  });

  it('preserves non-Indian numbers given with a country code', () => {
    expect(normalizePhone('+14155550100')).toBe('+14155550100');
  });

  it('returns empty/blank input as-is', () => {
    expect(normalizePhone('')).toBe('');
  });
});

describe('phoneMatchCandidates', () => {
  it('produces every equivalent stored format for a national number', () => {
    const c = phoneMatchCandidates('9880141543');
    expect(c).toEqual(expect.arrayContaining([
      '+919880141543', // E.164
      '919880141543',  // no plus
      '9880141543',    // 10-digit national
      '09880141543',   // trunk zero
    ]));
  });

  it('produces the same candidate set regardless of input format', () => {
    const fromE164 = phoneMatchCandidates('+919880141543').sort();
    const fromNational = phoneMatchCandidates('9880141543').sort();
    // Both must include the forms needed to find a legacy row either way.
    for (const form of ['+919880141543', '919880141543', '9880141543', '09880141543']) {
      expect(fromE164).toContain(form);
      expect(fromNational).toContain(form);
    }
  });

  it('de-duplicates candidates', () => {
    const c = phoneMatchCandidates('+919880141543');
    expect(new Set(c).size).toBe(c.length);
  });
});
