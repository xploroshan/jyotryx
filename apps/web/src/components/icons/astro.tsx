/**
 * Astrological glyphs: zodiac signs + classical planets.
 *
 * These aren't in lucide (our general icon family), and the previous
 * implementation rendered raw Unicode characters (♈, ☉, …) in a <span>,
 * which fell back to the OS font — inconsistent weights, and the Sun in
 * particular rendered as a hairline dot. So:
 *
 *  - Zodiac signs use Tabler's professional, uniform `IconZodiac*` set.
 *  - Planets use a small bespoke SVG set drawn on the same 24px grid /
 *    stroke language, so Sun…Saturn read as one coherent family.
 *
 * Both expose `size` (px) and `weight` (stroke width) like the lucide
 * wrappers in ./index.tsx.
 */

import type { ComponentType } from 'react';
import {
  IconZodiacAries,
  IconZodiacTaurus,
  IconZodiacGemini,
  IconZodiacCancer,
  IconZodiacLeo,
  IconZodiacVirgo,
  IconZodiacLibra,
  IconZodiacScorpio,
  IconZodiacSagittarius,
  IconZodiacCapricorn,
  IconZodiacAquarius,
  IconZodiacPisces,
  type IconProps,
} from '@tabler/icons-react';

/* ── Zodiac signs (Tabler) ───────────────────────────────────────── */

type TablerIcon = ComponentType<IconProps>;

const ZODIAC_ICONS: Record<string, TablerIcon> = {
  aries: IconZodiacAries,
  taurus: IconZodiacTaurus,
  gemini: IconZodiacGemini,
  cancer: IconZodiacCancer,
  leo: IconZodiacLeo,
  virgo: IconZodiacVirgo,
  libra: IconZodiacLibra,
  scorpio: IconZodiacScorpio,
  sagittarius: IconZodiacSagittarius,
  capricorn: IconZodiacCapricorn,
  aquarius: IconZodiacAquarius,
  pisces: IconZodiacPisces,
};

export function ZodiacGlyph({
  sign,
  size = 24,
  weight = 1.75,
  className,
}: {
  /** Sign slug/name, case-insensitive: "aries", "Leo", … */
  sign: string;
  size?: number;
  weight?: number;
  className?: string;
}) {
  const Cmp = ZODIAC_ICONS[sign?.toLowerCase?.() ?? ''];
  return Cmp ? <Cmp size={size} stroke={weight} className={className} aria-hidden /> : null;
}

/* ── Planets (bespoke, coherent line set) ────────────────────────── */

const PLANET_PATHS: Record<string, React.ReactNode> = {
  // ☉ — circle with a centred core.
  Sun: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // ☽ — crescent.
  Moon: <path d="M15 4.2a8.3 8.3 0 1 0 0 15.6 6.7 6.7 0 0 1 0-15.6z" />,
  // ☿ — horns over a circle over a cross.
  Mercury: (
    <>
      <path d="M8.7 4.4a3.3 3.3 0 0 0 6.6 0" />
      <circle cx="12" cy="11" r="3.4" />
      <path d="M12 14.4V21M9 17.8h6" />
    </>
  ),
  // ♀ — circle over a cross.
  Venus: (
    <>
      <circle cx="12" cy="8.4" r="4.6" />
      <path d="M12 13v8M8.6 17.3h6.8" />
    </>
  ),
  // ♂ — circle with an arrow to the upper-right.
  Mars: (
    <>
      <circle cx="10.5" cy="13.5" r="5.3" />
      <path d="M14.3 9.7 19.5 4.5M15 4.5h4.5v4.5" />
    </>
  ),
  // ♃ — the cross-and-hook "four".
  Jupiter: (
    <>
      <path d="M8 6.5c0 0 0 4.2 4.7 4.2" />
      <path d="M14 5.5v14" />
      <path d="M9.5 19.5H18" />
    </>
  ),
  // ♄ — cross over a descending scythe.
  Saturn: (
    <>
      <path d="M9.5 5v8M6.6 7.6h5.8" />
      <path d="M9.5 13c0-2 5.5-2 5.5 2 0 3-2.4 3.6-2.4 6.2" />
    </>
  ),
  // ☊ — Rahu, the ascending lunar node (cap open downward, footed).
  Rahu: (
    <>
      <path d="M7 16.5c0-6 2.2-9 5-9s5 3 5 9" />
      <circle cx="6.6" cy="17.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.4" cy="17.6" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  // ☋ — Ketu, the descending lunar node (cup open upward, footed).
  Ketu: (
    <>
      <path d="M7 7.5c0 6 2.2 9 5 9s5-3 5-9" />
      <circle cx="6.6" cy="6.4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.4" cy="6.4" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
};

export function PlanetGlyph({
  planet,
  size = 22,
  weight = 1.7,
  className,
}: {
  planet: string;
  size?: number;
  weight?: number;
  className?: string;
}) {
  const paths = PLANET_PATHS[planet];
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
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paths ?? <circle cx="12" cy="12" r="7.5" />}
    </svg>
  );
}
