// Shared helpers for the kundli chart renderers (North & South Indian).

export interface ChartHouse {
  house: number;
  sign: string;
  planets: string[];
}

export interface ChartPlanet {
  planet: string;
  sign: string;
  house: number;
  degree: number;
  isRetrograde: boolean;
  nakshatra?: string;
  status?: string;
}

// 1-based Vedic sign order.
export const SIGN_ORDER = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export function signNumber(sign: string | undefined): number | null {
  if (!sign) return null;
  const i = SIGN_ORDER.findIndex((s) => s.toLowerCase() === sign.trim().toLowerCase());
  return i < 0 ? null : i + 1;
}

// Full planet name → compact glyph used inside the small chart cells.
const PLANET_ABBR: Record<string, string> = {
  sun: 'Su', moon: 'Mo', mars: 'Ma', mercury: 'Me', jupiter: 'Ju',
  venus: 'Ve', saturn: 'Sa', rahu: 'Ra', ketu: 'Ke',
  uranus: 'Ur', neptune: 'Ne', pluto: 'Pl', ascendant: 'As',
};

export function abbr(planet: string): string {
  return PLANET_ABBR[planet.trim().toLowerCase()] ?? planet.slice(0, 2);
}

export interface CellPlanet {
  label: string;
  retro: boolean;
}

// Build a label like "Ma 11° (R)" minus the retro suffix (callers render the
// (R) themselves so they can colour it). Degree is floored to whole degrees.
export function planetLabel(p: ChartPlanet): string {
  const deg = Number.isFinite(p.degree) ? ` ${Math.floor(p.degree)}°` : '';
  return `${abbr(p.planet)}${deg}`;
}

/**
 * Preferred display order for the planet table (Ascendant first, classical
 * grahas, nodes, then the modern outer planets) regardless of the order the
 * API returns them in.
 */
export const PLANET_DISPLAY_ORDER = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
  'Rahu', 'Ketu', 'Uranus', 'Neptune', 'Pluto',
];

export function orderPlanets<T extends { planet: string }>(planets: T[]): T[] {
  return [...planets].sort(
    (a, b) =>
      (PLANET_DISPLAY_ORDER.indexOf(a.planet) + 1 || 99) -
      (PLANET_DISPLAY_ORDER.indexOf(b.planet) + 1 || 99),
  );
}
