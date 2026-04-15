/**
 * Web-side tradition registry.
 *
 * The authoritative registry lives on the API
 * (`apps/api/src/modules/astrology/traditions/index.ts`) — that's where
 * prompt templates, sign systems, house systems and ephemeris flags are
 * defined. This file is UI-only: slugs for the router, label i18n keys,
 * accent colours for the dashboards, and the per-tradition feature list
 * that drives the Navbar and each tradition's dashboard.
 *
 * The six tradition IDs are the same on both sides; if you add a new one
 * here, add it to the Prisma enum and the API registry too.
 */

export type TraditionId =
  | 'VEDIC'
  | 'WESTERN'
  | 'CHINESE'
  | 'HELLENISTIC'
  | 'HORARY'
  | 'MEDICAL';

export const TRADITION_IDS: TraditionId[] = [
  'VEDIC',
  'WESTERN',
  'CHINESE',
  'HELLENISTIC',
  'HORARY',
  'MEDICAL',
];

export interface TraditionFeature {
  slug: string;
  labelKey: string; // maps to t.nav.traditions[slug].features[feature.slug]
  href: string;
  available: boolean;
}

export interface WebTraditionConfig {
  id: TraditionId;
  slug: string; // URL segment
  labelKey: string; // maps to t.nav.traditions[slug].name
  taglineKey: string; // short description under the hero
  /** Tailwind badge classes — also used on tradition dashboards + focus mode */
  badgeClass: string;
  /** Tailwind bg/ring classes for the dashboard hero */
  heroClass: string;
  /** Emoji/glyph used in the switcher and tiles */
  icon: string;
  features: TraditionFeature[];
}

/** Badge colour palette — lifted from `app/my-day/page.tsx` so both files share one source. */
export const TRADITION_BADGE_COLORS: Record<TraditionId, string> = {
  VEDIC: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  WESTERN: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  CHINESE: 'bg-red-500/10 text-red-400 border-red-500/20',
  HELLENISTIC: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  HORARY: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  MEDICAL: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

/** Hero gradient background for each tradition's dashboard. */
export const TRADITION_HERO_COLORS: Record<TraditionId, string> = {
  VEDIC: 'from-amber-500/15 via-amber-500/5 to-transparent ring-amber-500/20',
  WESTERN: 'from-sky-500/15 via-sky-500/5 to-transparent ring-sky-500/20',
  CHINESE: 'from-red-500/15 via-red-500/5 to-transparent ring-red-500/20',
  HELLENISTIC: 'from-violet-500/15 via-violet-500/5 to-transparent ring-violet-500/20',
  HORARY: 'from-teal-500/15 via-teal-500/5 to-transparent ring-teal-500/20',
  MEDICAL: 'from-emerald-500/15 via-emerald-500/5 to-transparent ring-emerald-500/20',
};

export const WEB_TRADITIONS: Record<TraditionId, WebTraditionConfig> = {
  VEDIC: {
    id: 'VEDIC',
    slug: 'vedic',
    labelKey: 'traditionsUi.vedic.name',
    taglineKey: 'traditionsUi.vedic.tagline',
    badgeClass: TRADITION_BADGE_COLORS.VEDIC,
    heroClass: TRADITION_HERO_COLORS.VEDIC,
    icon: '🕉️',
    // Vedic features already ship at the top level (historical URLs).
    // The dashboard links to those directly rather than duplicating them.
    features: [
      { slug: 'kundli', labelKey: 'traditionsUi.vedic.features.kundli', href: '/kundli', available: true },
      { slug: 'matching', labelKey: 'traditionsUi.vedic.features.matching', href: '/matching', available: true },
      { slug: 'panchang', labelKey: 'traditionsUi.vedic.features.panchang', href: '/panchang', available: true },
      { slug: 'dasha', labelKey: 'traditionsUi.vedic.features.dasha', href: '/vedic/dasha', available: true },
      { slug: 'dosha', labelKey: 'traditionsUi.vedic.features.dosha', href: '/vedic/dosha', available: true },
      { slug: 'divisional', labelKey: 'traditionsUi.vedic.features.divisional', href: '/divisional', available: true },
    ],
  },
  WESTERN: {
    id: 'WESTERN',
    slug: 'western',
    labelKey: 'traditionsUi.western.name',
    taglineKey: 'traditionsUi.western.tagline',
    badgeClass: TRADITION_BADGE_COLORS.WESTERN,
    heroClass: TRADITION_HERO_COLORS.WESTERN,
    icon: '♈',
    features: [
      { slug: 'natal', labelKey: 'traditionsUi.western.features.natal', href: '/western/natal', available: true },
      { slug: 'transits', labelKey: 'traditionsUi.western.features.transits', href: '/western/transits', available: true },
      { slug: 'synastry', labelKey: 'traditionsUi.western.features.synastry', href: '/western/synastry', available: true },
    ],
  },
  CHINESE: {
    id: 'CHINESE',
    slug: 'chinese',
    labelKey: 'traditionsUi.chinese.name',
    taglineKey: 'traditionsUi.chinese.tagline',
    badgeClass: TRADITION_BADGE_COLORS.CHINESE,
    heroClass: TRADITION_HERO_COLORS.CHINESE,
    icon: '🐉',
    features: [
      { slug: 'bazi', labelKey: 'traditionsUi.chinese.features.bazi', href: '/chinese/bazi', available: true },
      { slug: 'zodiac', labelKey: 'traditionsUi.chinese.features.zodiac', href: '/chinese/zodiac', available: true },
      { slug: 'flying-stars', labelKey: 'traditionsUi.chinese.features.flyingStars', href: '/chinese/flying-stars', available: true },
    ],
  },
  HELLENISTIC: {
    id: 'HELLENISTIC',
    slug: 'hellenistic',
    labelKey: 'traditionsUi.hellenistic.name',
    taglineKey: 'traditionsUi.hellenistic.tagline',
    badgeClass: TRADITION_BADGE_COLORS.HELLENISTIC,
    heroClass: TRADITION_HERO_COLORS.HELLENISTIC,
    icon: '🏛️',
    features: [
      { slug: 'natal', labelKey: 'traditionsUi.hellenistic.features.natal', href: '/hellenistic/natal', available: true },
      { slug: 'profections', labelKey: 'traditionsUi.hellenistic.features.profections', href: '/hellenistic/profections', available: true },
      { slug: 'zodiacal-releasing', labelKey: 'traditionsUi.hellenistic.features.zodiacalReleasing', href: '/hellenistic/zodiacal-releasing', available: true },
    ],
  },
  HORARY: {
    id: 'HORARY',
    slug: 'horary',
    labelKey: 'traditionsUi.horary.name',
    taglineKey: 'traditionsUi.horary.tagline',
    badgeClass: TRADITION_BADGE_COLORS.HORARY,
    heroClass: TRADITION_HERO_COLORS.HORARY,
    icon: '⌛',
    features: [
      { slug: 'ask', labelKey: 'traditionsUi.horary.features.ask', href: '/horary/ask', available: true },
      { slug: 'history', labelKey: 'traditionsUi.horary.features.history', href: '/horary/history', available: true },
    ],
  },
  MEDICAL: {
    id: 'MEDICAL',
    slug: 'medical',
    labelKey: 'traditionsUi.medical.name',
    taglineKey: 'traditionsUi.medical.tagline',
    badgeClass: TRADITION_BADGE_COLORS.MEDICAL,
    heroClass: TRADITION_HERO_COLORS.MEDICAL,
    icon: '⚕️',
    features: [
      { slug: 'decumbiture', labelKey: 'traditionsUi.medical.features.decumbiture', href: '/medical/decumbiture', available: true },
      { slug: 'body-zodiac', labelKey: 'traditionsUi.medical.features.bodyZodiac', href: '/medical/body-zodiac', available: true },
    ],
  },
};

export const TRADITION_LIST: WebTraditionConfig[] = TRADITION_IDS.map(id => WEB_TRADITIONS[id]);

/** slug → tradition id lookup. */
export const SLUG_TO_TRADITION: Record<string, TraditionId> = TRADITION_LIST.reduce(
  (acc, t) => ({ ...acc, [t.slug]: t.id }),
  {} as Record<string, TraditionId>,
);

export function getTraditionBySlug(slug: string): WebTraditionConfig | null {
  const id = SLUG_TO_TRADITION[slug];
  return id ? WEB_TRADITIONS[id] : null;
}

/** Resolve the currently active tradition for the UI.
 *  Priority: explicit path segment > user's primary > first of their
 *  multi-select > VEDIC.
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
