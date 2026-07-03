/**
 * Pure request builders for the Vedic features. Each maps collected form values
 * + context to an exact API request, matching the web client payloads (see
 * docs/mobile/ANDROID_APP_PLAN.md §4 and the web *Client.tsx call sites).
 *
 * No React here — these are unit-tested directly (requests.test.ts).
 */
import { endpoints } from '@myastro360/shared';
import type { BuildRequest, FeatureRequest, RequestCtx, Values } from './types';
import { CITIES } from './constants';

function qs(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Optional numeric field → { key: n } or {} when blank/NaN. */
function num(key: string, raw: string | undefined): Record<string, number> {
  if (raw === undefined || raw.trim() === '') return {};
  const n = Number(raw);
  return Number.isFinite(n) ? { [key]: n } : {};
}

/** Optional string field → { key: v } or {} when blank. */
function opt(key: string, raw: string | undefined): Record<string, string> {
  return raw && raw.trim() !== '' ? { [key]: raw.trim() } : {};
}

function birth(ctx: RequestCtx): { dateOfBirth: string; timeOfBirth: string; placeOfBirth: string } {
  return {
    dateOfBirth: ctx.user?.dateOfBirth ?? '',
    timeOfBirth: ctx.user?.timeOfBirth ?? '',
    placeOfBirth: ctx.user?.placeOfBirth ?? '',
  };
}

function city(idx: string | undefined) {
  return CITIES[Number(idx)] ?? CITIES[0]!;
}

export const VEDIC_REQUESTS: Record<string, BuildRequest> = {
  kundli: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.kundli,
    body: {
      dateOfBirth: v.dob,
      timeOfBirth: v.tob,
      placeOfBirth: v.pob,
      locale: ctx.locale,
      tradition: 'VEDIC',
    },
  }),

  // Dasha reuses the kundli endpoint; birth details come from the profile.
  dasha: (_v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.kundli,
    body: { ...birth(ctx), locale: ctx.locale, tradition: 'VEDIC' },
  }),

  dosha: (_v, ctx): FeatureRequest => ({
    method: 'GET',
    path: endpoints.astrology.dosha + qs({ locale: ctx.locale }),
  }),

  divisional: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.divisional(v.chartType || '9'),
    body: {
      dateOfBirth: v.dob,
      timeOfBirth: v.tob,
      placeOfBirth: v.pob,
      ...num('latitude', v.lat),
      ...num('longitude', v.lng),
      locale: ctx.locale,
    },
  }),

  'kp-astrology': (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.kpChart,
    body: {
      dateOfBirth: v.dob,
      timeOfBirth: v.tob,
      placeOfBirth: v.pob,
      ...num('latitude', v.lat),
      ...num('longitude', v.lng),
      locale: ctx.locale,
    },
  }),

  matching: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.matching,
    body: {
      partner1: { dateOfBirth: v.a_dob, timeOfBirth: v.a_tob, placeOfBirth: v.a_pob },
      partner2: { dateOfBirth: v.b_dob, timeOfBirth: v.b_tob, placeOfBirth: v.b_pob },
      locale: ctx.locale,
      tradition: 'VEDIC',
    },
  }),

  horoscope: (v, ctx): FeatureRequest => ({
    method: 'GET',
    path:
      endpoints.astrology.horoscope(v.sign || 'aries') +
      qs({ period: v.period || 'daily', locale: ctx.locale, tradition: 'VEDIC' }),
  }),

  panchang: (_v, ctx): FeatureRequest => ({
    method: 'GET',
    path: endpoints.astrology.panchang + qs({ locale: ctx.locale }),
  }),

  muhurat: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.muhurat,
    body: {
      purpose: v.purpose || 'marriage',
      fromDate: v.fromDate,
      toDate: v.toDate,
      location: v.location,
      locale: ctx.locale,
    },
  }),

  'cosmic-calendar': (v, ctx): FeatureRequest => {
    const c = city(v.city);
    return {
      method: 'GET',
      path:
        endpoints.astrology.cosmicCalendar +
        qs({
          year: v.year,
          month: v.month,
          activity: v.activity || 'general',
          lat: c.lat,
          lng: c.lng,
          location: c.name,
        }),
    };
  },

  'decision-room': (v, ctx): FeatureRequest => {
    const c = city(v.city);
    return {
      method: 'POST',
      path: endpoints.astrology.timingDecision,
      body: {
        activity: v.activity || 'marriage',
        date: v.date,
        ...opt('time', v.time),
        latitude: c.lat,
        longitude: c.lng,
        location: c.name,
        locale: ctx.locale,
      },
    };
  },

  numerology: (v, ctx): FeatureRequest => {
    const mode = v.mode || 'name';
    if (mode === 'brand') {
      return { method: 'POST', path: endpoints.numerology.brand, body: { brandName: v.brandName, locale: ctx.locale } };
    }
    if (mode === 'personal-year') {
      return {
        method: 'GET',
        path: endpoints.numerology.personalYear + qs({ dateOfBirth: v.dob || ctx.user?.dateOfBirth, locale: ctx.locale }),
      };
    }
    return { method: 'POST', path: endpoints.numerology.name, body: { name: v.name, locale: ctx.locale } };
  },

  // Mulank reads the profile DOB server-side — no params.
  mulank: (): FeatureRequest => ({ method: 'GET', path: endpoints.numerology.mulank }),

  tarot: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.tarot.draw,
    body: { spread: v.spread || 'single', ...opt('question', v.question), locale: ctx.locale },
  }),

  vastu: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.vastu.analyze,
    body: {
      propertyType: v.propertyType || 'house',
      entranceDirection: v.entranceDirection || 'E',
      ...opt('concern', v.concern),
      locale: ctx.locale,
    },
  }),
};
