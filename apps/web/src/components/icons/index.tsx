/**
 * Tradition + feature icon set.
 *
 * Backed by lucide-react so every glyph shares a single icon family's
 * stroke weight, proportions and optical grid. This keeps the "editorial
 * line work" design language but makes it uniform — the previous set was
 * hand-drawn per icon, so weights and silhouettes drifted (e.g. the
 * horoscope sphere read heavier than its neighbours).
 *
 * Call sites stay unchanged: <TraditionGlyph id={...} /> and
 * <FeatureGlyph slug={...} />. Re-theming the whole app is now a matter
 * of editing the two maps below. `weight` maps to lucide's `strokeWidth`;
 * `size` to its pixel dimension.
 */

import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Aperture,
  BarChart3,
  Bed,
  Calculator,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Columns3,
  Compass,
  Flame,
  Grid3x3,
  Hand,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  History,
  Home,
  Hourglass,
  KeyRound,
  Landmark,
  Layers,
  LayoutGrid,
  MessageCircle,
  Orbit,
  PersonStanding,
  Rabbit,
  RotateCw,
  Scale,
  Sparkles,
  Star,
  Sun,
  Telescope,
  Timer,
  Users,
} from 'lucide-react';

import type { TraditionId } from '@/lib/traditions';

type LucideIcon = ComponentType<LucideProps>;

// `strokeWidth` is owned by the wrapper (exposed as `weight`); everything
// else lucide accepts — className, color, aria-* — passes straight through.
type GlyphProps = Omit<LucideProps, 'ref' | 'strokeWidth' | 'size'> & {
  size?: number;
  weight?: number;
};

/* ── Registry ────────────────────────────────────────────────────── */

const TRADITION_ICONS: Record<TraditionId, LucideIcon> = {
  VEDIC: Sun, // Surya — the solar core of Jyotisha
  WESTERN: Aperture, // segmented circle ≈ the zodiac wheel
  CHINESE: Compass, // the luopan / feng-shui compass
  HELLENISTIC: Landmark, // a classical temple façade
  HORARY: Hourglass, // a question fixed to a moment in time
  MEDICAL: HeartPulse, // health / the body
};

const FEATURE_ICONS: Record<string, LucideIcon> = {
  // Vedic
  chat: MessageCircle,
  kundli: LayoutGrid, // the birth-chart grid
  matching: HeartHandshake, // compatibility / kundli milan
  horoscope: Telescope, // reading the stars ahead
  panchang: CalendarDays, // the Hindu almanac
  muhurat: CalendarClock, // auspicious date + time
  'decision-room': Scale, // weighing options against the timing
  'cosmic-calendar': CalendarRange, // the month's sky events
  dasha: Timer, // planetary time periods
  dosha: Flame, // afflictions (Mangal etc.)
  divisional: BarChart3, // divisional / varga charts
  'kp-astrology': Sparkles, // KP cusp sub-lords
  palmistry: Hand,
  numerology: Calculator,
  mulank: Calculator, // root-number numerology (Mulank / Bhagyank)
  tarot: Layers, // a deck of cards
  vastu: Home, // directional architecture
  // Western
  natal: Star,
  transits: Orbit, // planets moving across the chart
  synastry: Users, // two charts / two people
  // Chinese
  bazi: Columns3, // the Four Pillars
  zodiac: Rabbit, // the animal cycle
  'flying-stars': Grid3x3, // the Lo Shu 3×3 grid
  // Hellenistic
  profections: RotateCw, // the annual time-lord rotation
  'zodiacal-releasing': KeyRound, // the Lots of Spirit/Fortune
  // Horary
  ask: HelpCircle,
  history: History,
  // Medical
  decumbiture: Bed, // chart for the moment of falling ill
  'body-zodiac': PersonStanding, // zodiac rulership over the body
  // Tradition / category landing chips — mirror the TRADITION_ICONS choices.
  vedic: Sun,
  western: Aperture,
  chinese: Compass,
  hellenistic: Landmark,
  horary: Hourglass,
  medical: HeartPulse,
};

/* ── Public components (stable API) ──────────────────────────────── */

export function TraditionGlyph({
  id,
  size = 22,
  weight = 1.5,
  ...rest
}: { id: TraditionId } & GlyphProps) {
  const Cmp = TRADITION_ICONS[id];
  return Cmp ? <Cmp size={size} strokeWidth={weight} aria-hidden {...rest} /> : null;
}

export function FeatureGlyph({
  slug,
  size = 22,
  weight = 1.5,
  ...rest
}: { slug: string } & GlyphProps) {
  const Cmp = FEATURE_ICONS[slug];
  return Cmp ? <Cmp size={size} strokeWidth={weight} aria-hidden {...rest} /> : null;
}
