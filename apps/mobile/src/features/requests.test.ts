import { VEDIC_REQUESTS } from './requests';
import type { RequestCtx } from './types';

const ctx: RequestCtx = {
  locale: 'en',
  user: {
    dateOfBirth: '1994-05-21',
    timeOfBirth: '14:30',
    placeOfBirth: 'Mumbai, India',
    name: 'Test',
    primaryTradition: 'VEDIC',
  },
};

describe('Vedic request builders', () => {
  it('kundli posts birth details + VEDIC tradition', () => {
    const r = VEDIC_REQUESTS.kundli!({ dob: '1994-05-21', tob: '14:30', pob: 'Mumbai' }, ctx);
    expect(r).toEqual({
      method: 'POST',
      path: '/astrology/kundli',
      body: { dateOfBirth: '1994-05-21', timeOfBirth: '14:30', placeOfBirth: 'Mumbai', locale: 'en', tradition: 'VEDIC' },
    });
  });

  it('dasha reuses the kundli endpoint with profile birth details', () => {
    const r = VEDIC_REQUESTS.dasha!({}, ctx);
    expect(r.method).toBe('POST');
    expect(r.path).toBe('/astrology/kundli');
    expect(r.body).toMatchObject({ dateOfBirth: '1994-05-21', timeOfBirth: '14:30', placeOfBirth: 'Mumbai, India', tradition: 'VEDIC' });
  });

  it('dosha is a GET with only locale', () => {
    expect(VEDIC_REQUESTS.dosha!({}, ctx)).toEqual({ method: 'GET', path: '/astrology/dosha?locale=en' });
  });

  it('divisional puts the chart type in the path and omits blank lat/lng', () => {
    const r = VEDIC_REQUESTS.divisional!({ chartType: '10', dob: 'd', tob: 't', pob: 'p', lat: '', lng: '' }, ctx);
    expect(r.path).toBe('/astrology/divisional/10');
    expect(r.body).not.toHaveProperty('latitude');
    expect(r.body).not.toHaveProperty('longitude');
  });

  it('kp includes numeric lat/lng when provided', () => {
    const r = VEDIC_REQUESTS['kp-astrology']!({ dob: 'd', tob: 't', pob: 'p', lat: '19.07', lng: '72.87' }, ctx);
    expect(r.path).toBe('/astrology/kp-chart');
    expect(r.body).toMatchObject({ latitude: 19.07, longitude: 72.87 });
  });

  it('matching nests two partners', () => {
    const r = VEDIC_REQUESTS.matching!(
      { a_dob: 'a1', a_tob: 'a2', a_pob: 'a3', b_dob: 'b1', b_tob: 'b2', b_pob: 'b3' },
      ctx,
    );
    expect(r.body).toEqual({
      partner1: { dateOfBirth: 'a1', timeOfBirth: 'a2', placeOfBirth: 'a3' },
      partner2: { dateOfBirth: 'b1', timeOfBirth: 'b2', placeOfBirth: 'b3' },
      locale: 'en',
      tradition: 'VEDIC',
    });
  });

  it('horoscope puts sign in path and period/locale/tradition in query', () => {
    const r = VEDIC_REQUESTS.horoscope!({ sign: 'leo', period: 'weekly' }, ctx);
    expect(r).toEqual({ method: 'GET', path: '/astrology/horoscope/leo?period=weekly&locale=en&tradition=VEDIC' });
  });

  it('muhurat posts purpose + date range + location', () => {
    const r = VEDIC_REQUESTS.muhurat!(
      { purpose: 'business', fromDate: '2026-07-01', toDate: '2026-07-31', location: 'Pune' },
      ctx,
    );
    expect(r.body).toEqual({ purpose: 'business', fromDate: '2026-07-01', toDate: '2026-07-31', location: 'Pune', locale: 'en' });
  });

  it('cosmic-calendar resolves city index to coordinates', () => {
    const r = VEDIC_REQUESTS['cosmic-calendar']!({ year: '2026', month: '7', activity: 'travel', city: '1' }, ctx);
    // city index 1 = Mumbai
    expect(r.path).toContain('lat=19.076');
    expect(r.path).toContain('lng=72.8777');
    expect(r.path).toContain('location=Mumbai');
    expect(r.path).toContain('activity=travel');
  });

  it('decision-room omits time when empty and includes coords', () => {
    const noTime = VEDIC_REQUESTS['decision-room']!({ activity: 'marriage', date: '2026-07-10', time: '', city: '0' }, ctx);
    expect(noTime.body).not.toHaveProperty('time');
    expect(noTime.body).toMatchObject({ latitude: 28.6139, longitude: 77.209, location: 'New Delhi' });
    const withTime = VEDIC_REQUESTS['decision-room']!({ activity: 'marriage', date: '2026-07-10', time: '09:15', city: '0' }, ctx);
    expect(withTime.body).toMatchObject({ time: '09:15' });
  });

  describe('numerology modes', () => {
    it('name → POST /numerology/name', () => {
      expect(VEDIC_REQUESTS.numerology!({ mode: 'name', name: 'Ada' }, ctx)).toEqual({
        method: 'POST',
        path: '/numerology/name',
        body: { name: 'Ada', locale: 'en' },
      });
    });
    it('brand → POST /numerology/brand', () => {
      expect(VEDIC_REQUESTS.numerology!({ mode: 'brand', brandName: 'Acme' }, ctx)).toEqual({
        method: 'POST',
        path: '/numerology/brand',
        body: { brandName: 'Acme', locale: 'en' },
      });
    });
    it('personal-year → GET with dateOfBirth query', () => {
      const r = VEDIC_REQUESTS.numerology!({ mode: 'personal-year', dob: '1994-05-21' }, ctx);
      expect(r).toEqual({ method: 'GET', path: '/numerology/personal-year?dateOfBirth=1994-05-21&locale=en' });
    });
  });

  it('mulank is a bare GET (profile-driven server-side)', () => {
    expect(VEDIC_REQUESTS.mulank!({}, ctx)).toEqual({ method: 'GET', path: '/numerology/mulank' });
  });

  it('tarot omits the question when blank, keeps it otherwise', () => {
    expect(VEDIC_REQUESTS.tarot!({ spread: 'three-card', question: '' }, ctx).body).toEqual({ spread: 'three-card', locale: 'en' });
    expect(VEDIC_REQUESTS.tarot!({ spread: 'single', question: 'When?' }, ctx).body).toMatchObject({ question: 'When?' });
  });

  it('vastu posts property + direction, omits blank concern', () => {
    expect(VEDIC_REQUESTS.vastu!({ propertyType: 'office', entranceDirection: 'NE', concern: '' }, ctx).body).toEqual({
      propertyType: 'office',
      entranceDirection: 'NE',
      locale: 'en',
    });
  });
});
