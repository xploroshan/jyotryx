/**
 * Signup context parsing — the server side of Phase 2 growth tagging.
 *
 * The web app captures signup locale / country from the browser and
 * (optionally) persists the user's chosen locale in the register body.
 * This parser has to accept the weighted Accept-Language header format
 * without leaking malformed tags into the database.
 */
import { parseAcceptLanguage, buildSignupContext } from '../src/modules/auth/signup-context';

describe('parseAcceptLanguage', () => {
  it('returns nulls for missing or empty headers', () => {
    expect(parseAcceptLanguage(undefined)).toEqual({ locale: null, country: null });
    expect(parseAcceptLanguage('')).toEqual({ locale: null, country: null });
    expect(parseAcceptLanguage(null as any)).toEqual({ locale: null, country: null });
  });

  it('picks the highest-quality tag when weights are present', () => {
    // `hi;q=0.9` beats `en;q=0.8` despite appearing later.
    expect(parseAcceptLanguage('en-US;q=0.8, hi-IN;q=0.9, ta;q=0.5')).toEqual({
      locale: 'hi',
      country: 'IN',
    });
  });

  it('defaults q=1 for tags without an explicit weight', () => {
    expect(parseAcceptLanguage('hi,en;q=0.9')).toEqual({ locale: 'hi', country: null });
  });

  it('ignores malformed tags', () => {
    expect(parseAcceptLanguage(',,invalid_tag,;;,en-US')).toEqual({
      locale: 'en',
      country: 'US',
    });
  });

  it('uppercases the country subtag consistently', () => {
    expect(parseAcceptLanguage('hi-in')).toEqual({ locale: 'hi', country: 'IN' });
  });
});

describe('buildSignupContext', () => {
  it('body values override the header-derived locale', () => {
    const ctx = buildSignupContext({
      acceptLanguage: 'en-US,en;q=0.9',
      bodyLocale: 'hi',
      bodyCountry: 'IN',
      bodySignupSource: 'google_ads',
    });
    expect(ctx).toEqual({ locale: 'hi', country: 'IN', signupSource: 'google_ads' });
  });

  it('falls back to the header when no body override', () => {
    const ctx = buildSignupContext({ acceptLanguage: 'ta-IN;q=0.9,hi;q=0.5' });
    expect(ctx).toEqual({ locale: 'ta', country: 'IN', signupSource: null });
  });

  it('clamps overly long source strings to 32 chars', () => {
    const long = 'a'.repeat(120);
    const ctx = buildSignupContext({ bodySignupSource: long });
    expect(ctx.signupSource?.length).toBe(32);
  });

  it('coerces empty or whitespace-only values to null', () => {
    const ctx = buildSignupContext({
      bodyLocale: '',
      bodyCountry: '',
      bodySignupSource: '   ',
    });
    expect(ctx).toEqual({ locale: null, country: null, signupSource: null });
  });

  it('lowercases locale and uppercases country', () => {
    const ctx = buildSignupContext({ bodyLocale: 'HI', bodyCountry: 'in' });
    expect(ctx).toEqual({ locale: 'hi', country: 'IN', signupSource: null });
  });
});
