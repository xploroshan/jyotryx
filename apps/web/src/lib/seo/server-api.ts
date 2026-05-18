/**
 * Server-side fetch helpers for the SEO landing pages.
 *
 * These are intentionally separate from `apps/web/src/lib/api.ts`:
 *   - That client uses `useAuthStore` and is "use client" only.
 *   - These are called from React Server Components during static
 *     generation / ISR revalidation, so they must work without a
 *     browser context.
 *
 * `fetch` is invoked with `next.revalidate` so each city page is
 * regenerated at most once per N seconds — the panchang changes daily,
 * so we ride the default revalidate set on the page itself.
 *
 * IMPORTANT (Next 16 + Turbopack): a page that exports
 * `export const revalidate = N` AND also calls `fetch(..., { next: {
 * revalidate: M } })` triggers `Invalid segment configuration export
 * detected` at build time, even though both forms were independently
 * valid in Next 14/15. The pages that use these helpers therefore
 * deliberately do NOT export a top-level `revalidate` — they rely on
 * the per-fetch hint here, which Next propagates to the page-level
 * revalidate automatically. If you ever add a page-level
 * `export const revalidate` here, you'll see the build break with
 * exactly that message.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://localhost:4000/api';

export interface PanchangPayload {
  date: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  vara: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  rahukaal: string;
  gulikakaal: string;
  yamakantaka: string;
}

/**
 * Fetch today's panchang for a given lat/lng. Designed for use inside
 * Server Components during build / ISR — never throws (we'd rather
 * render a graceful fallback than 500 the whole landing page when the
 * upstream is down).
 *
 * The `revalidate` knob lets the caller (page or layout) override the
 * default 6-hour cache life; muhurat pages might want shorter, the
 * directory page longer.
 */
export async function fetchPanchang(
  lat: number,
  lng: number,
  revalidateSeconds = 60 * 60 * 6,
): Promise<PanchangPayload | null> {
  try {
    const url = `${API_BASE_URL}/astrology/panchang?lat=${lat}&lng=${lng}`;
    const res = await fetch(url, {
      next: { revalidate: revalidateSeconds, tags: ['panchang'] },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as PanchangPayload;
  } catch {
    return null;
  }
}

export interface HoroscopePayload {
  sign: string;
  period: string;
  forecast: string;
  lucky_color?: string;
  lucky_number?: number;
  compatibility?: string;
}

export async function fetchHoroscope(
  sign: string,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
  revalidateSeconds = 60 * 60 * 6,
): Promise<HoroscopePayload | null> {
  try {
    const url = `${API_BASE_URL}/astrology/horoscope/${encodeURIComponent(
      sign,
    )}?period=${period}`;
    const res = await fetch(url, {
      next: { revalidate: revalidateSeconds, tags: ['horoscope'] },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as HoroscopePayload;
  } catch {
    return null;
  }
}

/** Origin used in canonical URLs and JSON-LD. */
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.myastro360.com';
