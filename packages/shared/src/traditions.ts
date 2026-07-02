/**
 * Framework-agnostic tradition registry — the portable core of
 * `apps/web/src/lib/traditions.ts`. UI-only slugs, labels, feature lists and
 * accent colours. The authoritative astrology registry (prompts, sign/house
 * systems, ephemeris flags) lives on the API
 * (`apps/api/src/modules/astrology/traditions/index.ts`).
 *
 * Web keeps Tailwind class strings for its badges; mobile can't use those, so
 * this shared copy adds `accentHex` per tradition for React Native theming.
 */

export type TraditionId = 'VEDIC' | 'WESTERN' | 'CHINESE' | 'HELLENISTIC' | 'HORARY' | 'MEDICAL';

export const TRADITION_IDS: readonly TraditionId[] = [
  'VEDIC',
  'WESTERN',
  'CHINESE',
  'HELLENISTIC',
  'HORARY',
  'MEDICAL',
];

export interface TraditionFeature {
  slug: string;
  /** i18n key: t.traditionsUi.<slug>.features.<feature> */
  labelKey: string;
  /** Web href — mirrored by the mobile route for the same feature. */
  href: string;
  available: boolean;
  icon?: string;
}

export interface TraditionConfig {
  id: TraditionId;
  slug: string;
  labelKey: string;
  taglineKey: string;
  icon: string;
  /** Accent colour for native (RN) theming — mirrors the web Tailwind hue. */
  accentHex: string;
  features: TraditionFeature[];
}

/** Accent hex per tradition — matches the `-500` Tailwind hue web uses. */
export const TRADITION_ACCENT_HEX: Record<TraditionId, string> = {
  VEDIC: '#f59e0b', // amber-500
  WESTERN: '#0ea5e9', // sky-500
  CHINESE: '#ef4444', // red-500
  HELLENISTIC: '#8b5cf6', // violet-500
  HORARY: '#14b8a6', // teal-500
  MEDICAL: '#10b981', // emerald-500
};

export const TRADITIONS: Record<TraditionId, TraditionConfig> = {
  VEDIC: {
    id: 'VEDIC',
    slug: 'vedic',
    labelKey: 'traditionsUi.vedic.name',
    taglineKey: 'traditionsUi.vedic.tagline',
    icon: '🕉️',
    accentHex: TRADITION_ACCENT_HEX.VEDIC,
    features: [
      { slug: 'chat', labelKey: 'traditionsUi.vedic.features.chat', href: '/chat', available: true, icon: '💬' },
      { slug: 'kundli', labelKey: 'traditionsUi.vedic.features.kundli', href: '/kundli', available: true, icon: '🔯' },
      { slug: 'palmistry', labelKey: 'traditionsUi.vedic.features.palmistry', href: '/palmistry', available: true, icon: '✋' },
      { slug: 'matching', labelKey: 'traditionsUi.vedic.features.matching', href: '/matching', available: true, icon: '💞' },
      { slug: 'horoscope', labelKey: 'traditionsUi.vedic.features.horoscope', href: '/horoscope', available: true, icon: '🔮' },
      { slug: 'panchang', labelKey: 'traditionsUi.vedic.features.panchang', href: '/panchang', available: true, icon: '📜' },
      { slug: 'muhurat', labelKey: 'traditionsUi.vedic.features.muhurat', href: '/muhurat', available: true, icon: '⏰' },
      { slug: 'decision-room', labelKey: 'traditionsUi.vedic.features.decisionRoom', href: '/decision-room', available: true, icon: '⚖️' },
      { slug: 'cosmic-calendar', labelKey: 'traditionsUi.vedic.features.cosmicCalendar', href: '/cosmic-calendar', available: true, icon: '🗓️' },
      { slug: 'dasha', labelKey: 'traditionsUi.vedic.features.dasha', href: '/vedic/dasha', available: true, icon: '🌀' },
      { slug: 'dosha', labelKey: 'traditionsUi.vedic.features.dosha', href: '/vedic/dosha', available: true, icon: '🔥' },
      { slug: 'divisional', labelKey: 'traditionsUi.vedic.features.divisional', href: '/divisional', available: true, icon: '📊' },
      { slug: 'kp-astrology', labelKey: 'traditionsUi.vedic.features.kpAstrology', href: '/kp-astrology', available: true, icon: '✨' },
      { slug: 'numerology', labelKey: 'traditionsUi.vedic.features.numerology', href: '/numerology', available: true, icon: '🔢' },
      { slug: 'mulank', labelKey: 'traditionsUi.vedic.features.mulank', href: '/vedic/mulank', available: true, icon: '🔟' },
      { slug: 'tarot', labelKey: 'traditionsUi.vedic.features.tarot', href: '/tarot', available: true, icon: '🎴' },
      { slug: 'vastu', labelKey: 'traditionsUi.vedic.features.vastu', href: '/vastu', available: true, icon: '🏛️' },
    ],
  },
  WESTERN: {
    id: 'WESTERN',
    slug: 'western',
    labelKey: 'traditionsUi.western.name',
    taglineKey: 'traditionsUi.western.tagline',
    icon: '♈',
    accentHex: TRADITION_ACCENT_HEX.WESTERN,
    features: [
      { slug: 'natal', labelKey: 'traditionsUi.western.features.natal', href: '/western/natal', available: true, icon: '🌟' },
      { slug: 'transits', labelKey: 'traditionsUi.western.features.transits', href: '/western/transits', available: true, icon: '🌠' },
      { slug: 'synastry', labelKey: 'traditionsUi.western.features.synastry', href: '/western/synastry', available: true, icon: '💞' },
    ],
  },
  CHINESE: {
    id: 'CHINESE',
    slug: 'chinese',
    labelKey: 'traditionsUi.chinese.name',
    taglineKey: 'traditionsUi.chinese.tagline',
    icon: '🐉',
    accentHex: TRADITION_ACCENT_HEX.CHINESE,
    features: [
      { slug: 'bazi', labelKey: 'traditionsUi.chinese.features.bazi', href: '/chinese/bazi', available: true, icon: '🀄' },
      { slug: 'zodiac', labelKey: 'traditionsUi.chinese.features.zodiac', href: '/chinese/zodiac', available: true, icon: '🐲' },
      { slug: 'flying-stars', labelKey: 'traditionsUi.chinese.features.flyingStars', href: '/chinese/flying-stars', available: true, icon: '⭐' },
    ],
  },
  HELLENISTIC: {
    id: 'HELLENISTIC',
    slug: 'hellenistic',
    labelKey: 'traditionsUi.hellenistic.name',
    taglineKey: 'traditionsUi.hellenistic.tagline',
    icon: '🏛️',
    accentHex: TRADITION_ACCENT_HEX.HELLENISTIC,
    features: [
      { slug: 'natal', labelKey: 'traditionsUi.hellenistic.features.natal', href: '/hellenistic/natal', available: true, icon: '🌟' },
      { slug: 'profections', labelKey: 'traditionsUi.hellenistic.features.profections', href: '/hellenistic/profections', available: true, icon: '📜' },
      { slug: 'zodiacal-releasing', labelKey: 'traditionsUi.hellenistic.features.zodiacalReleasing', href: '/hellenistic/zodiacal-releasing', available: true, icon: '🗝️' },
    ],
  },
  HORARY: {
    id: 'HORARY',
    slug: 'horary',
    labelKey: 'traditionsUi.horary.name',
    taglineKey: 'traditionsUi.horary.tagline',
    icon: '⌛',
    accentHex: TRADITION_ACCENT_HEX.HORARY,
    features: [
      { slug: 'ask', labelKey: 'traditionsUi.horary.features.ask', href: '/horary/ask', available: true, icon: '❓' },
      // History is client-side (localStorage on web / MMKV on mobile), no API.
      { slug: 'history', labelKey: 'traditionsUi.horary.features.history', href: '/horary/history', available: true, icon: '📚' },
    ],
  },
  MEDICAL: {
    id: 'MEDICAL',
    slug: 'medical',
    labelKey: 'traditionsUi.medical.name',
    taglineKey: 'traditionsUi.medical.tagline',
    icon: '⚕️',
    accentHex: TRADITION_ACCENT_HEX.MEDICAL,
    features: [
      { slug: 'decumbiture', labelKey: 'traditionsUi.medical.features.decumbiture', href: '/medical/decumbiture', available: true, icon: '🛏️' },
      { slug: 'body-zodiac', labelKey: 'traditionsUi.medical.features.bodyZodiac', href: '/medical/body-zodiac', available: true, icon: '🧬' },
    ],
  },
};

export const TRADITION_LIST: TraditionConfig[] = TRADITION_IDS.map((id) => TRADITIONS[id]);

export const SLUG_TO_TRADITION: Record<string, TraditionId> = TRADITION_LIST.reduce(
  (acc, t) => {
    acc[t.slug] = t.id;
    return acc;
  },
  {} as Record<string, TraditionId>,
);

export function getTraditionBySlug(slug: string): TraditionConfig | null {
  const id = SLUG_TO_TRADITION[slug];
  return id ? TRADITIONS[id] : null;
}

/**
 * Resolve the active tradition. Priority: explicit path segment > user's
 * primary > first of their multi-select > VEDIC. Mirrors web's
 * `resolveActiveTradition`.
 */
export function resolveActiveTradition(input: {
  pathname?: string;
  primaryTradition?: string | null;
  astrologyTraditions?: string[] | null;
}): TraditionId {
  const seg = input.pathname?.split('/').filter(Boolean)[0];
  if (seg && SLUG_TO_TRADITION[seg]) return SLUG_TO_TRADITION[seg];
  if (input.primaryTradition && TRADITION_IDS.includes(input.primaryTradition as TraditionId)) {
    return input.primaryTradition as TraditionId;
  }
  const first = input.astrologyTraditions?.[0];
  if (first && TRADITION_IDS.includes(first as TraditionId)) {
    return first as TraditionId;
  }
  return 'VEDIC';
}
