import { describe, it, expect } from 'vitest';
import { interpolate, buildFaqs } from '../interpolate';
import { en } from '../en';

describe('interpolate', () => {
  it('substitutes a single token', () => {
    expect(interpolate('Panchang for {city}', { city: 'Mumbai' })).toBe('Panchang for Mumbai');
  });

  it('substitutes repeated and multiple tokens', () => {
    expect(
      interpolate('{sign} is a {element} sign; {sign} rules.', { sign: 'Leo', element: 'fire' }),
    ).toBe('Leo is a fire sign; Leo rules.');
  });

  it('leaves unknown tokens intact', () => {
    expect(interpolate('Hello {name} from {city}', { city: 'Pune' })).toBe(
      'Hello {name} from Pune',
    );
  });

  it('leaves malformed braces untouched', () => {
    expect(interpolate('{ city } and {city', { city: 'Delhi' })).toBe('{ city } and {city');
  });

  it('handles templates with no tokens', () => {
    expect(interpolate('plain text', { city: 'Delhi' })).toBe('plain text');
  });
});

describe('buildFaqs', () => {
  it('returns q/a pairs in q1..qN order with tokens filled', () => {
    const section = {
      q2: 'Second question about {city}?',
      a2: 'Second answer.',
      q1: 'First question?',
      a1: 'First answer for {city}.',
    };
    expect(buildFaqs(section, { city: 'Jaipur' })).toEqual([
      { q: 'First question?', a: 'First answer for Jaipur.' },
      { q: 'Second question about Jaipur?', a: 'Second answer.' },
    ]);
  });

  it('stops at the first missing pair (no holes)', () => {
    const section = { q1: 'One?', a1: 'A1', q3: 'Three?', a3: 'A3' };
    expect(buildFaqs(section, {})).toHaveLength(1);
  });

  it('returns an empty list for a section with no q1/a1', () => {
    expect(buildFaqs({ faqHeading: 'h' }, {})).toEqual([]);
  });

  it('builds all 4 horoscope sign FAQs from the en dictionary', () => {
    const faqs = buildFaqs(en.horoscopeLanding.faqs, {
      sign: 'Aries',
      symbol: '♈',
      dateRange: 'March 21 – April 19',
      modality: 'cardinal',
      element: 'fire',
      rulingPlanet: 'Mars',
    });
    expect(faqs).toHaveLength(4);
    expect(faqs[0].q).toBe('What dates does the Aries zodiac sign cover?');
    expect(faqs[0].a).toContain('Aries (♈) covers birthdays between March 21 – April 19.');
    expect(faqs[1].a).toContain('Aries is a cardinal fire sign ruled by Mars.');
    // No token leaks anywhere in the built output.
    for (const f of faqs) {
      expect(f.q).not.toMatch(/\{\w+\}/);
      expect(f.a).not.toMatch(/\{\w+\}/);
    }
  });

  it('builds all 3 period FAQs and all 5 panchang FAQs without token leaks', () => {
    const period = buildFaqs(en.horoscopeLanding.periodFaqs, {
      sign: 'Leo',
      period: 'weekly',
      cadence: 'every week',
      adjective: 'this week',
    });
    expect(period).toHaveLength(3);
    const panchang = buildFaqs(en.panchangLanding.faqs, {
      city: 'Mumbai',
      lat: '19.0760',
      lng: '72.8777',
    });
    expect(panchang).toHaveLength(5);
    expect(panchang[1].a).toContain("Mumbai's coordinates (19.0760, 72.8777)");
    for (const f of [...period, ...panchang]) {
      expect(f.q).not.toMatch(/\{\w+\}/);
      expect(f.a).not.toMatch(/\{\w+\}/);
    }
  });
});
