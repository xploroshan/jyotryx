/**
 * Feature → verified endpoint resolver. Encodes the accuracy-reviewed endpoint
 * map (docs/mobile/ANDROID_APP_PLAN.md §4) at feature granularity so the
 * generic feature screen — and every real feature screen built later — shares
 * one contract. Keyed by `${TraditionId}:${featureSlug}` because some slugs
 * (e.g. `natal`) exist in more than one tradition.
 */
import { endpoints, type FeatureGate, type TraditionId } from '@myastro360/shared';

export interface FeatureEndpoint {
  method: 'GET' | 'POST' | 'CLIENT';
  /** Concrete path, or a human note for parameterised / client-side features. */
  path: string;
  gate: FeatureGate;
  /** Set when the feature has no dedicated route (reuse / client-side). */
  note?: string;
}

const MAP: Record<string, FeatureEndpoint> = {
  // ── Vedic ──
  'VEDIC:chat': { method: 'POST', path: endpoints.chat.message, gate: 'credit' },
  'VEDIC:kundli': { method: 'POST', path: endpoints.astrology.kundli, gate: 'credit' },
  'VEDIC:palmistry': { method: 'POST', path: endpoints.palmistry.analyze, gate: 'entitlement' },
  'VEDIC:matching': { method: 'POST', path: endpoints.astrology.matching, gate: 'credit' },
  'VEDIC:horoscope': { method: 'GET', path: '/astrology/horoscope/:sign', gate: 'free', note: 'sign in path' },
  'VEDIC:panchang': { method: 'GET', path: endpoints.astrology.panchang, gate: 'free' },
  'VEDIC:muhurat': { method: 'POST', path: endpoints.astrology.muhurat, gate: 'credit' },
  'VEDIC:decision-room': { method: 'POST', path: endpoints.astrology.timingDecision, gate: 'credit' },
  'VEDIC:cosmic-calendar': { method: 'GET', path: endpoints.astrology.cosmicCalendar, gate: 'free' },
  'VEDIC:dasha': {
    method: 'POST',
    path: endpoints.astrology.kundli,
    gate: 'credit',
    note: 'reuses kundli — dasha is in the kundli response',
  },
  'VEDIC:dosha': { method: 'GET', path: endpoints.astrology.dosha, gate: 'credit' },
  'VEDIC:divisional': { method: 'POST', path: '/astrology/divisional/:type', gate: 'credit', note: 'type in path' },
  'VEDIC:kp-astrology': { method: 'POST', path: endpoints.astrology.kpChart, gate: 'credit' },
  'VEDIC:numerology': { method: 'POST', path: endpoints.numerology.name, gate: 'credit', note: 'modes: name/brand/personal-year' },
  'VEDIC:mulank': { method: 'GET', path: endpoints.numerology.mulank, gate: 'credit' },
  'VEDIC:tarot': { method: 'POST', path: endpoints.tarot.draw, gate: 'credit' },
  'VEDIC:vastu': { method: 'POST', path: endpoints.vastu.analyze, gate: 'credit' },

  // ── Western ──
  'WESTERN:natal': { method: 'POST', path: endpoints.astrology.westernNatal, gate: 'credit' },
  'WESTERN:transits': { method: 'POST', path: endpoints.astrology.westernTransits, gate: 'credit' },
  'WESTERN:synastry': { method: 'POST', path: endpoints.astrology.westernSynastry, gate: 'credit' },

  // ── Chinese ──
  'CHINESE:bazi': { method: 'POST', path: endpoints.astrology.bazi, gate: 'credit' },
  'CHINESE:zodiac': { method: 'GET', path: '/astrology/chinese-zodiac/:year', gate: 'free', note: 'year in path' },
  'CHINESE:flying-stars': { method: 'GET', path: endpoints.astrology.flyingStars, gate: 'credit' },

  // ── Hellenistic ──
  'HELLENISTIC:natal': {
    method: 'POST',
    path: endpoints.astrology.kundli,
    gate: 'credit',
    note: 'reuses kundli (shared engine)',
  },
  'HELLENISTIC:profections': { method: 'POST', path: endpoints.astrology.hellenisticProfections, gate: 'credit' },
  'HELLENISTIC:zodiacal-releasing': {
    method: 'POST',
    path: endpoints.astrology.hellenisticZodiacalReleasing,
    gate: 'credit',
  },

  // ── Horary ──
  'HORARY:ask': { method: 'POST', path: endpoints.astrology.horaryAsk, gate: 'credit' },
  'HORARY:history': {
    method: 'CLIENT',
    path: 'MMKV (local)',
    gate: 'free',
    note: 'client-side history — no API',
  },

  // ── Medical ──
  'MEDICAL:decumbiture': { method: 'POST', path: endpoints.astrology.medicalDecumbiture, gate: 'credit' },
  'MEDICAL:body-zodiac': { method: 'GET', path: endpoints.astrology.medicalBodyZodiac, gate: 'free' },
};

export function resolveFeatureEndpoint(
  tradition: TraditionId,
  slug: string,
): FeatureEndpoint | null {
  return MAP[`${tradition}:${slug}`] ?? null;
}
