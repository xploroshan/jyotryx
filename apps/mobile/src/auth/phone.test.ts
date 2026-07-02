import { toE164, isValidOtp } from './phone';

describe('toE164', () => {
  it('prefixes +91 to a bare 10-digit mobile', () => {
    expect(toE164('9876543210')).toBe('+919876543210');
  });
  it('strips separators and a trunk zero', () => {
    expect(toE164('098765 43210')).toBe('+919876543210');
    expect(toE164('98765-43210')).toBe('+919876543210');
  });
  it('passes through valid E.164 unchanged', () => {
    expect(toE164('+14155552671')).toBe('+14155552671');
  });
  it('rejects junk', () => {
    expect(toE164('')).toBeNull();
    expect(toE164('12345')).toBeNull();
    expect(toE164('+0123')).toBeNull();
    expect(toE164('abcdefghij')).toBeNull();
    expect(toE164('0000000000')).toBeNull();
  });
});

describe('isValidOtp', () => {
  it('accepts 4–6 digits', () => {
    expect(isValidOtp('1234')).toBe(true);
    expect(isValidOtp('123456')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isValidOtp('123')).toBe(false);
    expect(isValidOtp('1234567')).toBe(false);
    expect(isValidOtp('12a4')).toBe(false);
  });
});
