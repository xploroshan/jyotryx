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
  /** Emoji shown on Tier-2 feature chips. Pure decoration; the label
   *  is the source of truth for accessibility. */
  icon?: string;
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

/** Badge colour palette — lifted from `app/my-day/page.tsx` so both files share one source.
 *  Bumped from `-400` text / `/10` bg to `-700` text / `/15` bg so chips remain readable
 *  on the Warm Linen canvas. */
export const TRADITION_BADGE_COLORS: Record<TraditionId, string> = {
  VEDIC: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  WESTERN: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
  CHINESE: 'bg-red-500/15 text-red-700 border-red-500/30',
  HELLENISTIC: 'bg-violet-500/15 text-violet-700 border-violet-500/30',
  HORARY: 'bg-teal-500/15 text-teal-700 border-teal-500/30',
  MEDICAL: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
};

/** Hero gradient background for each tradition's dashboard. */
export const TRADITION_HERO_COLORS: Record<TraditionId, string> = {
  VEDIC: 'from-amber-500/10 via-transparent to-transparent',
  WESTERN: 'from-sky-500/10 via-transparent to-transparent',
  CHINESE: 'from-red-500/10 via-transparent to-transparent',
  HELLENISTIC: 'from-violet-500/10 via-transparent to-transparent',
  HORARY: 'from-teal-500/10 via-transparent to-transparent',
  MEDICAL: 'from-emerald-500/10 via-transparent to-transparent',
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
    // Vedic is the flagship tradition. My Day deliberately lives outside
    // this list — it's a cross-tradition shortcut surfaced as the first
    // pill in the TraditionRail itself, not a Vedic-only feature.
    features: [
      { slug: 'chat', labelKey: 'traditionsUi.vedic.features.chat', href: '/chat', available: true, icon: '💬' },
      { slug: 'kundli', labelKey: 'traditionsUi.vedic.features.kundli', href: '/kundli', available: true, icon: '🔯' },
      { slug: 'matching', labelKey: 'traditionsUi.vedic.features.matching', href: '/matching', available: true, icon: '💞' },
      { slug: 'horoscope', labelKey: 'traditionsUi.vedic.features.horoscope', href: '/horoscope', available: true, icon: '🔮' },
      { slug: 'panchang', labelKey: 'traditionsUi.vedic.features.panchang', href: '/panchang', available: true, icon: '📜' },
      { slug: 'muhurat', labelKey: 'traditionsUi.vedic.features.muhurat', href: '/muhurat', available: true, icon: '⏰' },
      { slug: 'dasha', labelKey: 'traditionsUi.vedic.features.dasha', href: '/vedic/dasha', available: true, icon: '🌀' },
      { slug: 'dosha', labelKey: 'traditionsUi.vedic.features.dosha', href: '/vedic/dosha', available: true, icon: '🔥' },
      { slug: 'divisional', labelKey: 'traditionsUi.vedic.features.divisional', href: '/divisional', available: true, icon: '📊' },
      { slug: 'kp-astrology', labelKey: 'traditionsUi.vedic.features.kpAstrology', href: '/kp-astrology', available: true, icon: '✨' },
      { slug: 'palmistry', labelKey: 'traditionsUi.vedic.features.palmistry', href: '/palmistry', available: true, icon: '✋' },
      { slug: 'numerology', labelKey: 'traditionsUi.vedic.features.numerology', href: '/numerology', available: true, icon: '🔢' },
      { slug: 'tarot', labelKey: 'traditionsUi.vedic.features.tarot', href: '/tarot', available: true, icon: '🎴' },
      { slug: 'vastu', labelKey: 'traditionsUi.vedic.features.vastu', href: '/vastu', available: true, icon: '🏛️' },
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
    badgeClass: TRADITION_BADGE_COLORS.CHINESE,
    heroClass: TRADITION_HERO_COLORS.CHINESE,
    icon: '🐉',
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
    badgeClass: TRADITION_BADGE_COLORS.HELLENISTIC,
    heroClass: TRADITION_HERO_COLORS.HELLENISTIC,
    icon: '🏛️',
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
    badgeClass: TRADITION_BADGE_COLORS.HORARY,
    heroClass: TRADITION_HERO_COLORS.HORARY,
    icon: '⌛',
    features: [
      { slug: 'ask', labelKey: 'traditionsUi.horary.features.ask', href: '/horary/ask', available: true, icon: '❓' },
      { slug: 'history', labelKey: 'traditionsUi.horary.features.history', href: '/horary/history', available: true, icon: '📚' },
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
      { slug: 'decumbiture', labelKey: 'traditionsUi.medical.features.decumbiture', href: '/medical/decumbiture', available: true, icon: '🛏️' },
      { slug: 'body-zodiac', labelKey: 'traditionsUi.medical.features.bodyZodiac', href: '/medical/body-zodiac', available: true, icon: '🧬' },
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

/**
 * Reverse map: every feature's `href` → the tradition that owns it. Built
 * once from the registry so a feature page like `/horoscope` or
 * `/western/natal` can be traced back to its tradition. Hrefs are unique
 * per feature; if two ever collided, the earlier tradition in
 * `TRADITION_IDS` wins (a stable, deterministic tiebreak).
 */
export const FEATURE_PATH_TO_TRADITION: Record<string, TraditionId> = (() => {
  const map: Record<string, TraditionId> = {};
  for (const id of TRADITION_IDS) {
    for (const f of WEB_TRADITIONS[id].features) {
      if (!(f.href in map)) map[f.href] = id;
    }
  }
  return map;
})();

/**
 * Which tradition does this pathname belong to? Covers both tradition
 * dashboards / tradition-scoped routes (`/vedic`, `/vedic/dasha`,
 * `/western/natal`) via the first path segment, and top-level feature
 * pages (`/kundli`, `/horoscope`, `/chat`) via the feature-href map.
 * Returns null for tradition-agnostic routes (`/my-day`, `/`, `/profile`,
 * `/pricing`, `/reports`) — callers fall back to remembered state there.
 */
export function resolveTraditionFromPath(pathname: string): TraditionId | null {
  const seg = pathname.split('/').filter(Boolean)[0] ?? '';
  if (SLUG_TO_TRADITION[seg]) return SLUG_TO_TRADITION[seg];
  for (const [href, id] of Object.entries(FEATURE_PATH_TO_TRADITION)) {
    if (pathname === href || pathname.startsWith(href + '/')) return id;
  }
  return null;
}
