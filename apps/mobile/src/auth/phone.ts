/**
 * Phone normalization for the OTP flow. The API's DTO regex is
 * `^\+?[1-9]\d{1,14}$` (E.164-ish) and the backend assumes +91 for bare
 * 10-digit numbers — the web always sends `+91` + the 10 digits. Pure,
 * unit-tested.
 */

/** Normalize a user-typed phone to E.164 (default country +91).
 *  Returns null when the input can't be a valid number. */
export function toE164(input: string, countryCode = '+91'): string | null {
  const raw = input.replace(/[\s\-()]/g, '');
  if (!raw) return null;

  if (raw.startsWith('+')) {
    return /^\+[1-9]\d{7,14}$/.test(raw) ? raw : null;
  }

  // Strip an Indian trunk zero, then expect the bare 10-digit mobile.
  const digits = raw.replace(/^0/, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 10 && /^[1-9]/.test(digits)) return `${countryCode}${digits}`;
  return null;
}

export function isValidOtp(otp: string): boolean {
  return /^\d{4,6}$/.test(otp.trim());
}
