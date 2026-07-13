/**
 * Live panchang fetch for the myastro360 Instagram engine.
 *
 * Mirrors the semantics of apps/web/src/lib/seo/server-api.ts#fetchPanchang:
 * never throws — any failure (unset base URL, network error, timeout,
 * non-2xx, bad JSON) returns null so the caller can fall back to evergreen
 * content instead of fabricating panchang values.
 *
 * Node 20+ ESM, zero dependencies (global fetch + AbortSignal.timeout).
 */

const TIMEOUT_MS = 15000;

/**
 * Fetch today's panchang for a lat/lng from the myastro360 API.
 *
 * @param {object} args
 * @param {number} args.lat
 * @param {number} args.lng
 * @param {string} [args.apiBase] - API base URL, e.g. https://api.myastro360.com/api
 * @returns {Promise<{ date: string, tithi: string, nakshatra: string, yoga?: string,
 *   karana?: string, vara?: string, sunrise: string, sunset: string, moonrise?: string,
 *   rahukaal: string, gulikakaal?: string, yamakantaka?: string } | null>}
 */
export async function fetchPanchang({ lat, lng, apiBase = process.env.MYASTRO_API_URL } = {}) {
  if (!apiBase) return null;
  try {
    const base = apiBase.replace(/\/+$/, '');
    const url = `${base}/astrology/panchang?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Replace {token} occurrences in a string with values from a map.
 * Unknown tokens are left untouched (so a missed substitution is visible in
 * review, never silently blanked); non-string input is returned as-is.
 *
 * @param {string} text
 * @param {Record<string, unknown>} map - e.g. { tithi, nakshatra, rahu_kaal, ... }
 * @returns {string}
 */
export function substituteTokens(text, map = {}) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{([\w-]+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(map, key) && map[key] != null
      ? String(map[key])
      : match,
  );
}
