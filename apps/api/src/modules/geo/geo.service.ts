import { Injectable, Logger } from '@nestjs/common';
import { ProxyAgent } from 'undici';
import { MemoryCacheService } from '../../common/cache.service';

/** A single geocoding suggestion returned to the birthplace autocomplete. */
export interface GeoSuggestion {
  /** The primary place name (e.g. "Mumbai"). */
  name: string;
  /** A disambiguating label (e.g. "Mumbai, Maharashtra, India"). */
  label: string;
  lat: number;
  lng: number;
  country: string | null;
  state: string | null;
  countryCode: string | null;
}

// Photon (Komoot) — a free, key-less OSM geocoder built for type-ahead. We
// proxy it server-side so the browser never talks to it directly: that lets us
// cache aggressively (birthplaces repeat heavily across users), send a proper
// identifying User-Agent, and keep the upstream swappable without a client
// deploy.
const PHOTON_URL = 'https://photon.komoot.io/api/';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — place coordinates don't move
const REQUEST_TIMEOUT_MS = 4000;
const MIN_QUERY_LEN = 2;
const MAX_LIMIT = 8;

// OSM feature classes that make sense as a "place of birth". Photon returns
// streets, shops, POIs etc. too; we keep the answer to inhabited places and
// administrative areas so the list reads like a city picker, not a map search.
const PLACE_OSM_KEYS = new Set(['place', 'boundary']);
const PLACE_OSM_VALUES = new Set([
  'city', 'town', 'village', 'hamlet', 'suburb', 'municipality',
  'county', 'district', 'state', 'region', 'province',
  'administrative', 'locality',
]);

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  // Native fetch (undici) does NOT honour HTTPS_PROXY on its own. In a
  // locked-down egress environment where all outbound HTTPS must traverse a
  // proxy, a direct call to Photon would silently fail (→ empty autocomplete).
  // Build a ProxyAgent dispatcher once when a proxy is configured; otherwise
  // fetch goes direct. Computed lazily so tests that mock fetch are unaffected.
  private readonly proxyDispatcher = (() => {
    const proxy =
      process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    if (!proxy) return undefined;
    try {
      return new ProxyAgent(proxy);
    } catch {
      return undefined;
    }
  })();

  constructor(private readonly cache: MemoryCacheService) {}

  /**
   * Type-ahead geocoding for a birthplace. Returns [] (never throws) for a too-
   * short query or any upstream failure, so the autocomplete degrades to a
   * plain text field rather than erroring.
   */
  async search(query: string, limit = 6, lang = 'en'): Promise<GeoSuggestion[]> {
    const q = (query ?? '').trim();
    if (q.length < MIN_QUERY_LEN) return [];
    const cappedLimit = Math.min(Math.max(1, Math.floor(limit) || 6), MAX_LIMIT);
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';

    const cacheKey = `geo:search:v1:${safeLang}:${cappedLimit}:${q.toLowerCase()}`;
    // Cache reads/writes are best-effort: a Redis outage must degrade to a live
    // (or empty) lookup, never surface as a 500 on the autocomplete. Hence each
    // cache call is guarded on its own rather than trusting Redis to be up.
    try {
      const cached = await this.cache.get<GeoSuggestion[]>(cacheKey);
      if (cached) return cached;
    } catch (err) {
      this.logger.warn(`Geo cache read failed for "${q}": ${(err as Error)?.message ?? err}`);
    }

    let results: GeoSuggestion[] = [];
    try {
      results = await this.fetchPhoton(q, cappedLimit, safeLang);
    } catch (err) {
      this.logger.warn(`Geo search failed for "${q}": ${(err as Error)?.message ?? err}`);
      return [];
    }
    // Cache even an empty result — a typo that yields nothing shouldn't hammer
    // the upstream on every keystroke repeat.
    try {
      await this.cache.set(cacheKey, results, CACHE_TTL_MS);
    } catch (err) {
      this.logger.warn(`Geo cache write failed for "${q}": ${(err as Error)?.message ?? err}`);
    }
    return results;
  }

  private async fetchPhoton(q: string, limit: number, lang: string): Promise<GeoSuggestion[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      // Photon caps at the requested limit; over-fetch a little because we drop
      // non-place features below, then trim back to `limit`.
      const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=${Math.min(limit * 3, 20)}&lang=${lang}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Photon/OSM etiquette: identify the app so the free service can
          // reach us if we misbehave.
          'User-Agent': 'MyAstro360/1.0 (birthplace autocomplete; +https://www.myastro360.com)',
          Accept: 'application/json',
        },
        // `dispatcher` is an undici extension not present in the DOM fetch types.
        ...(this.proxyDispatcher ? ({ dispatcher: this.proxyDispatcher } as Record<string, unknown>) : {}),
      });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const body = (await res.json()) as { features?: PhotonFeature[] };
      return this.normalize(body.features ?? [], limit);
    } finally {
      clearTimeout(timer);
    }
  }

  private normalize(features: PhotonFeature[], limit: number): GeoSuggestion[] {
    const out: GeoSuggestion[] = [];
    const seen = new Set<string>();
    for (const f of features) {
      const p = f.properties ?? {};
      const coords = f.geometry?.coordinates;
      const name = p.name?.trim();
      if (!name || !Array.isArray(coords) || coords.length < 2) continue;

      // Keep the answer to inhabited/administrative places.
      const isPlace =
        (p.osm_key && PLACE_OSM_KEYS.has(p.osm_key)) ||
        (p.osm_value && PLACE_OSM_VALUES.has(p.osm_value));
      if (!isPlace) continue;

      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      // Dedupe near-identical hits (same name + coarse coords) that Photon can
      // return for a place's several OSM records.
      const key = `${name.toLowerCase()}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        name,
        label: this.buildLabel(name, p),
        lat,
        lng,
        country: p.country?.trim() || null,
        state: p.state?.trim() || null,
        countryCode: p.countrycode?.trim()?.toUpperCase() || null,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** "Mumbai, Maharashtra, India" — skips segments that repeat the name. */
  private buildLabel(name: string, p: PhotonFeature['properties'] = {}): string {
    const parts = [name];
    for (const seg of [p.state, p.country]) {
      const s = seg?.trim();
      if (s && !parts.some((x) => x.toLowerCase() === s.toLowerCase())) parts.push(s);
    }
    return parts.join(', ');
  }
}
