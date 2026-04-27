/**
 * Server-safe zodiac data for the SEO horoscope landing pages.
 *
 * The interactive client horoscope page (`/horoscope`) reads its
 * sign labels from the i18n translation hook, which only works
 * inside a "use client" component. Server components that need to
 * render labels for `generateStaticParams` and metadata can't use
 * that, so we keep a small static table here.
 *
 * Dates are tropical / Western astrology conventions — the same the
 * existing /horoscope page uses on the front-end.
 */

export interface ZodiacSign {
  slug: string;
  name: string;
  symbol: string;
  /** "March 21 – April 19", etc. — used in metadata + body copy. */
  dateRange: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  rulingPlanet: string;
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { slug: 'aries',       name: 'Aries',       symbol: '♈', dateRange: 'March 21 – April 19',       element: 'Fire',  modality: 'Cardinal', rulingPlanet: 'Mars' },
  { slug: 'taurus',      name: 'Taurus',      symbol: '♉', dateRange: 'April 20 – May 20',         element: 'Earth', modality: 'Fixed',    rulingPlanet: 'Venus' },
  { slug: 'gemini',      name: 'Gemini',      symbol: '♊', dateRange: 'May 21 – June 20',          element: 'Air',   modality: 'Mutable',  rulingPlanet: 'Mercury' },
  { slug: 'cancer',      name: 'Cancer',      symbol: '♋', dateRange: 'June 21 – July 22',         element: 'Water', modality: 'Cardinal', rulingPlanet: 'Moon' },
  { slug: 'leo',         name: 'Leo',         symbol: '♌', dateRange: 'July 23 – August 22',       element: 'Fire',  modality: 'Fixed',    rulingPlanet: 'Sun' },
  { slug: 'virgo',       name: 'Virgo',       symbol: '♍', dateRange: 'August 23 – September 22',  element: 'Earth', modality: 'Mutable',  rulingPlanet: 'Mercury' },
  { slug: 'libra',       name: 'Libra',       symbol: '♎', dateRange: 'September 23 – October 22', element: 'Air',   modality: 'Cardinal', rulingPlanet: 'Venus' },
  { slug: 'scorpio',     name: 'Scorpio',     symbol: '♏', dateRange: 'October 23 – November 21',  element: 'Water', modality: 'Fixed',    rulingPlanet: 'Mars / Pluto' },
  { slug: 'sagittarius', name: 'Sagittarius', symbol: '♐', dateRange: 'November 22 – December 21', element: 'Fire',  modality: 'Mutable',  rulingPlanet: 'Jupiter' },
  { slug: 'capricorn',   name: 'Capricorn',   symbol: '♑', dateRange: 'December 22 – January 19',  element: 'Earth', modality: 'Cardinal', rulingPlanet: 'Saturn' },
  { slug: 'aquarius',    name: 'Aquarius',    symbol: '♒', dateRange: 'January 20 – February 18',  element: 'Air',   modality: 'Fixed',    rulingPlanet: 'Saturn / Uranus' },
  { slug: 'pisces',      name: 'Pisces',      symbol: '♓', dateRange: 'February 19 – March 20',    element: 'Water', modality: 'Mutable',  rulingPlanet: 'Jupiter / Neptune' },
];

const BY_SLUG = new Map(ZODIAC_SIGNS.map((s) => [s.slug, s]));

export function findSignBySlug(slug: string): ZodiacSign | undefined {
  return BY_SLUG.get(slug);
}

export function listSignSlugs(): string[] {
  return ZODIAC_SIGNS.map((s) => s.slug);
}
