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
  locale?: string,
): Promise<PanchangPayload | null> {
  try {
    const localeQ = locale && locale !== 'en' ? `&locale=${encodeURIComponent(locale)}` : '';
    const url = `${API_BASE_URL}/astrology/panchang?lat=${lat}&lng=${lng}${localeQ}`;
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
  locale?: string,
): Promise<HoroscopePayload | null> {
  try {
    const localeQ = locale && locale !== 'en' ? `&locale=${encodeURIComponent(locale)}` : '';
    const url = `${API_BASE_URL}/astrology/horoscope/${encodeURIComponent(
      sign,
    )}?period=${period}${localeQ}`;
    const res = await fetch(url, {
      next: { revalidate: revalidateSeconds, tags: ['horoscope'] },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    // The API (HoroscopeResult) returns prediction/luckyColor/luckyNumber, but
    // the SEO pages read forecast/lucky_color/lucky_number. Map explicitly —
    // casting the raw JSON left forecast/lucky_* undefined, so the forecast body
    // and lucky stats rendered blank on every horoscope landing page.
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      sign: String(raw.sign ?? sign),
      period: String(raw.period ?? period),
      forecast: String(raw.forecast ?? raw.prediction ?? ''),
      lucky_color: (raw.lucky_color ?? raw.luckyColor) as string | undefined,
      lucky_number: (raw.lucky_number ?? raw.luckyNumber) as number | undefined,
      compatibility: (raw.compatibility ?? raw.compatibleSign) as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the operator-configured pricing settings (public endpoint — the same
 * one PricingClient hits). Used by the /pricing server wrapper so plan cards
 * and the Service/Offer JSON-LD render with real prices in initial HTML.
 * Short revalidate: the admin panel promises pricing/visibility changes reach
 * the public page quickly — an hour-stale price (or a stale
 * pricing_page_enabled flip) makes the admin distrust their own toggles, and
 * display could disagree with the live-validated checkout for that whole hour.
 */
export async function fetchPricing(
  revalidateSeconds = 60,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/pricing`, {
      next: { revalidate: revalidateSeconds, tags: ['pricing'] },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, string>;
  } catch {
    return null;
  }
}

export interface SharedMatchGuna {
  guna: string;
  maxPoints: number;
  obtainedPoints: number;
  description: string;
}

export interface SharedMatchPayload {
  token: string;
  personAName: string;
  personBName: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  compatibility: string;
  recommendation: string;
  manglikA: boolean;
  manglikB: boolean;
  gunaDetails: SharedMatchGuna[];
  locale?: string | null;
  createdAt: string;
}

/**
 * Fetch a publicly shared Kundli-match snapshot by token. Snapshots are
 * immutable once created, so a server-render per request is fine; we use
 * `no-store` to keep the (best-effort) view counter meaningful and avoid any
 * ISR segment-config coupling. Never throws — returns null on miss/error so
 * the page can render its own not-found state.
 */
export async function fetchSharedMatch(token: string): Promise<SharedMatchPayload | null> {
  try {
    const url = `${API_BASE_URL}/astrology/matching/shared/${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as SharedMatchPayload;
  } catch {
    return null;
  }
}

/** Origin used in canonical URLs and JSON-LD. */
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.myastro360.com';
