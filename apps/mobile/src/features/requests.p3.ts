/**
 * Pure request builders for the P3 traditions, matching the web client payloads
 * (verified via the western/chinese/hellenistic/horary/medical page.tsx call
 * sites). No React — unit-tested in requests.p3.test.ts.
 */
import { endpoints } from '@myastro360/shared';
import type { BuildRequest, FeatureRequest, RequestCtx } from './types';

function qs(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function opt(key: string, raw: string | undefined): Record<string, string> {
  return raw && raw.trim() !== '' ? { [key]: raw.trim() } : {};
}

const noop: BuildRequest = (): FeatureRequest => ({ method: 'GET', path: '' });

export const WESTERN_REQUESTS: Record<string, BuildRequest> = {
  natal: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.westernNatal,
    body: { dateOfBirth: v.dob, timeOfBirth: v.tob, placeOfBirth: v.pob, locale: ctx.locale },
  }),
  // Transits read birth details from the profile (no place).
  transits: (_v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.westernTransits,
    body: { dateOfBirth: ctx.user?.dateOfBirth ?? '', timeOfBirth: ctx.user?.timeOfBirth ?? '', locale: ctx.locale },
  }),
  synastry: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.westernSynastry,
    body: {
      partner1: { dateOfBirth: v.a_dob, timeOfBirth: v.a_tob },
      partner2: { dateOfBirth: v.b_dob, timeOfBirth: v.b_tob },
      locale: ctx.locale,
    },
  }),
};

export const CHINESE_REQUESTS: Record<string, BuildRequest> = {
  bazi: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.bazi,
    body: { dateOfBirth: v.dob, timeOfBirth: v.tob, placeOfBirth: v.pob, locale: ctx.locale },
  }),
  zodiac: (v, ctx): FeatureRequest => ({
    method: 'GET',
    path: endpoints.astrology.chineseZodiac(v.year || '2000') + qs({ locale: ctx.locale }),
  }),
  'flying-stars': (v, ctx): FeatureRequest => ({
    method: 'GET',
    path: endpoints.astrology.flyingStars + qs({ year: v.year, locale: ctx.locale }),
  }),
};

export const HELLENISTIC_REQUESTS: Record<string, BuildRequest> = {
  // Hellenistic natal reuses the shared kundli engine with a tradition flag.
  natal: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.kundli,
    body: { dateOfBirth: v.dob, timeOfBirth: v.tob, placeOfBirth: v.pob, locale: ctx.locale, tradition: 'HELLENISTIC' },
  }),
  profections: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.hellenisticProfections,
    body: { dateOfBirth: v.dob, locale: ctx.locale },
  }),
  // Zodiacal releasing reads DOB from the profile.
  'zodiacal-releasing': (_v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.hellenisticZodiacalReleasing,
    body: { dateOfBirth: ctx.user?.dateOfBirth ?? '', locale: ctx.locale },
  }),
};

export const HORARY_REQUESTS: Record<string, BuildRequest> = {
  ask: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.horaryAsk,
    body: { question: v.question, locale: ctx.locale },
  }),
  // History is client-side (MMKV) — handled by a custom screen, never built.
  history: noop,
};

export const MEDICAL_REQUESTS: Record<string, BuildRequest> = {
  decumbiture: (v, ctx): FeatureRequest => ({
    method: 'POST',
    path: endpoints.astrology.medicalDecumbiture,
    body: {
      decumbitureDate: v.date,
      decumbitureTime: v.time,
      ...opt('symptomsDescription', v.symptoms),
      locale: ctx.locale,
    },
  }),
  'body-zodiac': (_v, ctx): FeatureRequest => ({
    method: 'GET',
    path: endpoints.astrology.medicalBodyZodiac + qs({ locale: ctx.locale }),
  }),
};

export type { RequestCtx };
