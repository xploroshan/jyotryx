/**
 * Phone-number helpers shared across auth (Firebase + backend OTP) and the
 * profile editor, so the same human number always resolves to ONE account no
 * matter how it was typed or stored.
 *
 * The bug this prevents: the profile form stored numbers verbatim (e.g.
 * "9880141543") while Firebase phone auth returns E.164 ("+919880141543").
 * A direct equality lookup missed the existing account and created a
 * duplicate. `phoneMatchCandidates` lets the lookup recognise legacy rows in
 * any of the common formats.
 */

/**
 * Canonical form: strip separators, ensure a leading '+', and assume +91
 * (India) for a bare 10-digit number. A domestic trunk '0' is dropped before
 * the country code is applied.
 */
export function normalizePhone(raw: string): string {
  if (!raw) return raw;
  const digits = raw.replace(/[\s\-()]/g, '').trim();
  if (digits.startsWith('+')) return digits;
  const national = digits.replace(/^0+/, '');
  return national.length === 10 ? `+91${national}` : `+${digits}`;
}

/**
 * Every equivalent stored form to match against, so a returning user whose
 * number predates normalization is recognised instead of duplicated. For
 * "+919880141543" this yields the E.164 form, the no-plus form
 * ("919880141543"), the 10-digit national form ("9880141543"), and the
 * trunk-zero form ("09880141543").
 */
export function phoneMatchCandidates(raw: string): string[] {
  const norm = normalizePhone(raw);
  const noPlus = norm.replace(/^\+/, '');
  const last10 = norm.slice(-10);
  return Array.from(new Set([norm, noPlus, last10, `0${last10}`, raw.trim()]));
}
