/**
 * Inline-SVG icon set for traditions and features.
 *
 * All icons share the same 24×24 viewBox, currentColor stroke, and
 * stroke-based geometry so they render at any size and inherit the
 * surrounding text colour. They are intentionally simple silhouettes —
 * the brand vocabulary is "editorial line work", not "filled glyphs".
 *
 * Each icon is registered against the slug it represents so the
 * `<Icon name={slug} />` consumer (TraditionRail, FeatureChips) can
 * look it up by tradition id or feature slug without a switch
 * statement at the call site.
 */

import type { SVGProps } from 'react';

// `stroke` is a real SVG attribute, so we name the line-thickness prop
// `weight` to avoid colliding with the underlying SVGProps definition.
type BaseProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size?: number;
  weight?: number;
};

function Svg({
  size = 22,
  weight = 1.5,
  children,
  ...rest
}: BaseProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ── Tradition icons ─────────────────────────────────────────────── */

export const VedicIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Stylised sun-with-three-rays — a clean western standin for ॐ
        whose own glyph reads as text rather than icon. */}
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </Svg>
);

export const WesternIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Zodiac wheel — circle with cardinal axes. */}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17M3.5 12h17" />
    <circle cx="12" cy="12" r="2.5" />
  </Svg>
);

export const ChineseIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Yin-yang — circle with S divider, plus the two dots. */}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a4.25 4.25 0 0 1 0 8.5 4.25 4.25 0 0 0 0 8.5" />
    <circle cx="12" cy="7.7" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="16.3" r="0.8" fill="currentColor" stroke="none" />
  </Svg>
);

export const HellenisticIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Greek column — capital, fluted shaft, base. */}
    <path d="M5 5h14M6 8h12M8 8v10M16 8v10M5 19h14M6 21h12" />
  </Svg>
);

export const HoraryIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Hourglass. */}
    <path d="M6 3h12M6 21h12M7 3v3l5 4-5 4v4M17 3v3l-5 4 5 4v4" />
  </Svg>
);

export const MedicalIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Asclepius staff — vertical staff with a single coiled snake. */}
    <path d="M12 3v18" />
    <path d="M12 6c-2 1-2 3 0 4s2 3 0 4 2 3 0 4" />
    <path d="M9 4l3-1 3 1" />
  </Svg>
);

/* ── Feature icons ───────────────────────────────────────────────── */

export const ChatIcon = (p: BaseProps) => (
  <Svg {...p}>
    <path d="M4 11.5c0-3.6 3.4-6.5 8-6.5s8 2.9 8 6.5-3.4 6.5-8 6.5c-1.1 0-2.1-.2-3-.5L5 19l1-3.4a6 6 0 0 1-2-4.1z" />
  </Svg>
);

export const KundliIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* North-Indian kundli chart — square with two diagonals + cross. */}
    <rect x="3.5" y="3.5" width="17" height="17" rx="0.5" />
    <path d="M3.5 3.5l17 17M20.5 3.5l-17 17" />
  </Svg>
);

export const MatchingIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Two interlocking rings. */}
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
  </Svg>
);

export const HoroscopeIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Crystal sphere with a star at its centre. */}
    <circle cx="12" cy="13" r="6.5" />
    <path d="M12 10v6M9 13h6M10.4 11.4l3.2 3.2M13.6 11.4l-3.2 3.2" strokeWidth="1.2" />
    <path d="M6 19l12 0" />
  </Svg>
);

export const PanchangIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Open scroll. */}
    <path d="M5 5h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 0 0-6h11" />
    <path d="M5 5a3 3 0 0 0 0 6" />
    <path d="M9 9h6M9 13h6" strokeWidth="1.2" />
  </Svg>
);

export const MuhuratIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Clock face with a small cosmic accent (12 = star). */}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3 2" />
    <path d="M12 3.5v1M12 19.5v1M3.5 12h1M19.5 12h1" strokeWidth="1.2" />
  </Svg>
);

export const DashaIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Concentric arcs — planetary periods. */}
    <path d="M3.5 12a8.5 8.5 0 0 1 8.5-8.5" />
    <path d="M6.5 12a5.5 5.5 0 0 1 5.5-5.5" />
    <path d="M9.5 12a2.5 2.5 0 0 1 2.5-2.5" />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const DoshaIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Flame. */}
    <path d="M12 3c2 4 5 5.5 5 9.5a5 5 0 0 1-10 0c0-2 1-3 2-4-0 2 1 3 2 3-1-3 0-6 1-8.5z" />
  </Svg>
);

export const DivisionalIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Bar chart. */}
    <path d="M4 20V10M9 20V6M14 20v-9M19 20V4" />
    <path d="M3.5 20.5h17" strokeWidth="1.2" />
  </Svg>
);

export const KpAstrologyIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Sparkle/star with spoke — the KP cusp emphasis. */}
    <path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Svg>
);

export const PalmistryIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Open hand. */}
    <path d="M9 13V5.5a1.5 1.5 0 0 1 3 0V12" />
    <path d="M12 11.5V4a1.5 1.5 0 0 1 3 0v8" />
    <path d="M15 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1.5a4 4 0 0 1-4-4v-3l-2-3a1.4 1.4 0 0 1 2-2l2 2.5" />
  </Svg>
);

export const NumerologyIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* "1 2 3" — three numerals arranged as a glyph. */}
    <path d="M5 8.5l1.5-1V16M10.5 9a2 2 0 1 1 3 1.5L10.5 16h4M17 9a2 2 0 1 1 2.5 2 2 2 0 1 1-2.5 2" />
  </Svg>
);

export const TarotIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Three fanned cards. */}
    <rect x="9" y="4" width="6" height="16" rx="1" />
    <path d="M15 5l4 1.5-3 14-4-1.4" />
    <path d="M9 5L5 6.5l3 14 4-1.4" />
  </Svg>
);

export const VastuIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Compass — square plot with NSEW indicator. */}
    <rect x="3.5" y="3.5" width="17" height="17" rx="0.5" />
    <path d="M12 6.5l1.6 5.5L12 17.5l-1.6-5.5z" />
    <path d="M6.5 12h11" strokeWidth="1.2" />
  </Svg>
);

export const NatalIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* 8-point star. */}
    <path d="M12 3l1.5 7.5L21 12l-7.5 1.5L12 21l-1.5-7.5L3 12l7.5-1.5z" />
  </Svg>
);

export const TransitsIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Orbital arrows around a sun. */}
    <circle cx="12" cy="12" r="2" />
    <path d="M5 12a7 7 0 0 1 11.5-5.4" />
    <path d="M14 4l2.5 2.6L14 9" />
    <path d="M19 12a7 7 0 0 1-11.5 5.4" />
    <path d="M10 20l-2.5-2.6L10 15" />
  </Svg>
);

export const SynastryIcon = MatchingIcon;

export const BaziIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Four pillars. */}
    <path d="M5 5v14M10 5v14M14 5v14M19 5v14" />
    <path d="M3.5 5h17M3.5 19h17" strokeWidth="1.2" />
  </Svg>
);

export const ZodiacIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* 12-segment circle. */}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" strokeWidth="1.2" />
  </Svg>
);

export const FlyingStarsIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Lo Shu 3×3 grid of dots. */}
    {[6, 12, 18].flatMap((cx) =>
      [6, 12, 18].map((cy) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="1.2"
          fill="currentColor"
          stroke="none"
        />
      )),
    )}
  </Svg>
);

export const ProfectionsIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Pie slice. */}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 12L12 3.5M12 12L19.6 8" />
  </Svg>
);

export const ZodiacalReleasingIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Chained loops. */}
    <circle cx="8" cy="12" r="4" />
    <circle cx="16" cy="12" r="4" />
    <path d="M8 8v8M16 8v8" strokeWidth="1.2" />
  </Svg>
);

export const AskIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Question mark in circle. */}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 1.5-2.5 3.5" />
    <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
  </Svg>
);

export const HistoryIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Open book. */}
    <path d="M12 6S9 4 4 4v14c5 0 8 2 8 2s3-2 8-2V4c-5 0-8 2-8 2z" />
    <path d="M12 6v16" />
  </Svg>
);

export const DecumbitureIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Bed. */}
    <path d="M3 18v-5h18v5" />
    <path d="M3 18v3M21 18v3" />
    <rect x="6" y="9" width="6" height="4" rx="1" />
    <path d="M3 13h18" />
  </Svg>
);

export const BodyZodiacIcon = (p: BaseProps) => (
  <Svg {...p}>
    {/* Vitruvian-style figure. */}
    <circle cx="12" cy="6" r="2" />
    <path d="M12 8v8M5 12h14M8 20l4-4 4 4" />
  </Svg>
);

/* ── Registry ────────────────────────────────────────────────────── */

import type { TraditionId } from '@/lib/traditions';

const TRADITION_ICONS: Record<TraditionId, (p: BaseProps) => React.JSX.Element> = {
  VEDIC: VedicIcon,
  WESTERN: WesternIcon,
  CHINESE: ChineseIcon,
  HELLENISTIC: HellenisticIcon,
  HORARY: HoraryIcon,
  MEDICAL: MedicalIcon,
};

const FEATURE_ICONS: Record<string, (p: BaseProps) => React.JSX.Element> = {
  // Vedic
  chat: ChatIcon,
  kundli: KundliIcon,
  matching: MatchingIcon,
  horoscope: HoroscopeIcon,
  panchang: PanchangIcon,
  muhurat: MuhuratIcon,
  dasha: DashaIcon,
  dosha: DoshaIcon,
  divisional: DivisionalIcon,
  'kp-astrology': KpAstrologyIcon,
  palmistry: PalmistryIcon,
  numerology: NumerologyIcon,
  tarot: TarotIcon,
  vastu: VastuIcon,
  // Western
  natal: NatalIcon,
  transits: TransitsIcon,
  synastry: SynastryIcon,
  // Chinese
  bazi: BaziIcon,
  zodiac: ZodiacIcon,
  'flying-stars': FlyingStarsIcon,
  // Hellenistic
  profections: ProfectionsIcon,
  'zodiacal-releasing': ZodiacalReleasingIcon,
  // Horary
  ask: AskIcon,
  history: HistoryIcon,
  // Medical
  decumbiture: DecumbitureIcon,
  'body-zodiac': BodyZodiacIcon,
};

export function TraditionGlyph({
  id,
  ...rest
}: { id: TraditionId } & BaseProps) {
  const Cmp = TRADITION_ICONS[id];
  return Cmp ? <Cmp {...rest} /> : null;
}

export function FeatureGlyph({
  slug,
  ...rest
}: { slug: string } & BaseProps) {
  const Cmp = FEATURE_ICONS[slug];
  return Cmp ? <Cmp {...rest} /> : null;
}
