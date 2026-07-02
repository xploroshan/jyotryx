import { WESTERN_REQUESTS, CHINESE_REQUESTS, HELLENISTIC_REQUESTS, HORARY_REQUESTS, MEDICAL_REQUESTS } from './requests.p3';
import type { RequestCtx } from './types';

const ctx: RequestCtx = {
  locale: 'en',
  user: { dateOfBirth: '1994-05-21', timeOfBirth: '14:30', placeOfBirth: 'Mumbai', name: 'T', primaryTradition: 'WESTERN' },
};

describe('Western builders', () => {
  it('natal posts full birth triple (no tradition flag)', () => {
    expect(WESTERN_REQUESTS.natal!({ dob: 'd', tob: 't', pob: 'p' }, ctx)).toEqual({
      method: 'POST',
      path: '/astrology/western/natal',
      body: { dateOfBirth: 'd', timeOfBirth: 't', placeOfBirth: 'p', locale: 'en' },
    });
  });
  it('transits use the profile and omit place', () => {
    const r = WESTERN_REQUESTS.transits!({}, ctx);
    expect(r.path).toBe('/astrology/western/transits');
    expect(r.body).toEqual({ dateOfBirth: '1994-05-21', timeOfBirth: '14:30', locale: 'en' });
    expect(r.body).not.toHaveProperty('placeOfBirth');
  });
  it('synastry nests two partners with dob+tob only', () => {
    const r = WESTERN_REQUESTS.synastry!({ a_dob: 'a1', a_tob: 'a2', b_dob: 'b1', b_tob: 'b2' }, ctx);
    expect(r.body).toEqual({
      partner1: { dateOfBirth: 'a1', timeOfBirth: 'a2' },
      partner2: { dateOfBirth: 'b1', timeOfBirth: 'b2' },
      locale: 'en',
    });
  });
});

describe('Chinese builders', () => {
  it('bazi posts birth triple', () => {
    expect(CHINESE_REQUESTS.bazi!({ dob: 'd', tob: 't', pob: 'p' }, ctx).path).toBe('/astrology/bazi');
  });
  it('zodiac puts year in the path with locale query', () => {
    expect(CHINESE_REQUESTS.zodiac!({ year: '1994' }, ctx)).toEqual({
      method: 'GET',
      path: '/astrology/chinese-zodiac/1994?locale=en',
    });
  });
  it('flying-stars is a GET with year+locale query', () => {
    expect(CHINESE_REQUESTS['flying-stars']!({ year: '2026' }, ctx)).toEqual({
      method: 'GET',
      path: '/astrology/chinese/flying-stars?year=2026&locale=en',
    });
  });
});

describe('Hellenistic builders', () => {
  it('natal reuses kundli with a HELLENISTIC tradition flag', () => {
    const r = HELLENISTIC_REQUESTS.natal!({ dob: 'd', tob: 't', pob: 'p' }, ctx);
    expect(r.path).toBe('/astrology/kundli');
    expect(r.body).toMatchObject({ tradition: 'HELLENISTIC' });
  });
  it('profections send only dateOfBirth', () => {
    expect(HELLENISTIC_REQUESTS.profections!({ dob: '1994-05-21' }, ctx)).toEqual({
      method: 'POST',
      path: '/astrology/hellenistic/profections',
      body: { dateOfBirth: '1994-05-21', locale: 'en' },
    });
  });
  it('zodiacal-releasing reads the profile DOB', () => {
    expect(HELLENISTIC_REQUESTS['zodiacal-releasing']!({}, ctx).body).toEqual({ dateOfBirth: '1994-05-21', locale: 'en' });
  });
});

describe('Horary + Medical builders', () => {
  it('horary ask posts the question', () => {
    expect(HORARY_REQUESTS.ask!({ question: 'Will it work?' }, ctx)).toEqual({
      method: 'POST',
      path: '/astrology/horary/ask',
      body: { question: 'Will it work?', locale: 'en' },
    });
  });
  it('decumbiture omits symptoms when blank', () => {
    expect(MEDICAL_REQUESTS.decumbiture!({ date: '2026-07-02', time: '09:00', symptoms: '' }, ctx).body).toEqual({
      decumbitureDate: '2026-07-02',
      decumbitureTime: '09:00',
      locale: 'en',
    });
    expect(MEDICAL_REQUESTS.decumbiture!({ date: '2026-07-02', time: '09:00', symptoms: 'headache' }, ctx).body).toMatchObject({
      symptomsDescription: 'headache',
    });
  });
  it('body-zodiac is a GET with only locale', () => {
    expect(MEDICAL_REQUESTS['body-zodiac']!({}, ctx)).toEqual({ method: 'GET', path: '/astrology/medical/body-zodiac?locale=en' });
  });
});
