import { Injectable, Logger } from '@nestjs/common';

/** A single geocoding suggestion returned to the birthplace autocomplete. */
export interface GeoSuggestion {
  /** The primary place name (e.g. "Mumbai"). */
  name: string;
  /** A disambiguating label (e.g. "Mumbai, India"). */
  label: string;
  lat: number;
  lng: number;
  country: string | null;
  state: string | null;
  countryCode: string | null;
}

// We geocode entirely OFFLINE from a bundled dataset (`all-the-cities`:
// GeoNames populated places > 1000 people, ~135k worldwide). An earlier version
// proxied the Photon web service, but the deployed backend can't reach it
// (egress policy), so every lookup silently returned nothing. A bundled dataset
// removes that whole class of failure: no network, no rate limits, deterministic
// results, and — because each city carries its population — the most prominent
// match ranks first (so "Delhi" resolves to Delhi, India, not a US hamlet).
const MIN_QUERY_LEN = 2;
const MAX_LIMIT = 8;

/**
 * Normalise for matching: strip diacritics and lowercase, so an ASCII query
 * ("Zurich", "Sao Paulo", "Bogota") matches the accented dataset name
 * ("Zürich", "São Paulo", "Bogotá"). Applied symmetrically to the index and
 * the query. Without this, accented cities silently return nothing — or worse,
 * a tiny same-spelled homonym outranks the real city because the real one was
 * filtered out.
 */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

interface CityRecord {
  name: string;
  nameLower: string;
  country: string; // ISO-3166 alpha-2
  lat: number;
  lng: number;
  population: number;
}

interface RawCity {
  name: string;
  country: string;
  population: number;
  loc: { coordinates: [number, number] }; // [lng, lat]
}

// Common historical/anglicised names GeoNames stores only under the modern
// spelling. Without these, a user typing "Bangalore" or "Bombay" gets nothing.
// Each clones the modern city's coordinates under the old name.
const CITY_ALIASES: Array<{ name: string; lat: number; lng: number; country: string; population: number }> = [
  { name: 'Bangalore', lat: 12.9719, lng: 77.5937, country: 'IN', population: 8443675 },
  { name: 'Bombay', lat: 19.0760, lng: 72.8777, country: 'IN', population: 12691836 },
  { name: 'Calcutta', lat: 22.5726, lng: 88.3639, country: 'IN', population: 4631392 },
  { name: 'Madras', lat: 13.0827, lng: 80.2707, country: 'IN', population: 6727000 },
  { name: 'Poona', lat: 18.5204, lng: 73.8567, country: 'IN', population: 2935744 },
  { name: 'Trivandrum', lat: 8.5241, lng: 76.9366, country: 'IN', population: 743691 },
  { name: 'Cochin', lat: 9.9312, lng: 76.2673, country: 'IN', population: 596473 },
  { name: 'Mysore', lat: 12.2958, lng: 76.6394, country: 'IN', population: 887446 },
  { name: 'Mangalore', lat: 12.9141, lng: 74.8560, country: 'IN', population: 484785 },
  { name: 'Baroda', lat: 22.3072, lng: 73.1812, country: 'IN', population: 1666703 },
  { name: 'Gurgaon', lat: 28.4595, lng: 77.0266, country: 'IN', population: 876824 },
  { name: 'Pondicherry', lat: 11.9416, lng: 79.8083, country: 'IN', population: 244377 },
  { name: 'Vizag', lat: 17.6868, lng: 83.2185, country: 'IN', population: 2035922 },
  { name: 'Gauhati', lat: 26.1445, lng: 91.7362, country: 'IN', population: 957352 },
];

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  // Sorted-by-name index, built lazily on first search (loading + sorting 135k
  // rows costs a few hundred ms once, so we don't pay it at boot).
  private index: CityRecord[] | null = null;
  private readonly regionNames = this.buildRegionNames();

  private buildRegionNames(): Intl.DisplayNames | null {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      return null;
    }
  }

  private buildIndex(): CityRecord[] {
    if (this.index) return this.index;
    const recs: CityRecord[] = [];
    try {
      // Required lazily so module load stays light and test runs that never
      // geocode don't pay for it.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cities = require('all-the-cities') as RawCity[];
      for (const c of cities) {
        const coords = c.loc?.coordinates;
        if (!coords || coords.length < 2) continue;
        recs.push({
          name: c.name,
          nameLower: fold(c.name),
          country: c.country,
          lat: coords[1],
          lng: coords[0],
          population: c.population || 0,
        });
      }
    } catch (err) {
      this.logger.error(`Failed to load city dataset: ${(err as Error)?.message ?? err}`);
    }
    for (const a of CITY_ALIASES) {
      recs.push({ name: a.name, nameLower: fold(a.name), country: a.country, lat: a.lat, lng: a.lng, population: a.population });
    }
    recs.sort((a, b) => (a.nameLower < b.nameLower ? -1 : a.nameLower > b.nameLower ? 1 : 0));
    this.index = recs;
    return recs;
  }

  /**
   * Type-ahead / geocoding for a birthplace. Prefix-matches the query against
   * the bundled city index and returns the most-populous matches first. Returns
   * [] (never throws) for a too-short query or any internal error.
   */
  async search(query: string, limit = 6, _lang = 'en'): Promise<GeoSuggestion[]> {
    const q = fold((query ?? '').trim());
    if (q.length < MIN_QUERY_LEN) return [];
    const cappedLimit = Math.min(Math.max(1, Math.floor(limit) || 6), MAX_LIMIT);

    try {
      const idx = this.buildIndex();
      // Binary-search the first entry whose name >= q, then walk the prefix run.
      let lo = 0;
      let hi = idx.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (idx[mid].nameLower < q) lo = mid + 1;
        else hi = mid;
      }
      const matches: CityRecord[] = [];
      for (let i = lo; i < idx.length && idx[i].nameLower.startsWith(q); i++) {
        matches.push(idx[i]);
      }
      // Most prominent first so an ambiguous name resolves to the city the user
      // most likely means.
      matches.sort((a, b) => b.population - a.population);

      const out: GeoSuggestion[] = [];
      const seen = new Set<string>();
      for (const m of matches) {
        const key = `${m.nameLower}|${m.country}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          name: m.name,
          label: this.buildLabel(m),
          lat: m.lat,
          lng: m.lng,
          country: this.countryName(m.country),
          state: null,
          countryCode: m.country || null,
        });
        if (out.length >= cappedLimit) break;
      }
      return out;
    } catch (err) {
      this.logger.warn(`Geo search failed for "${q}": ${(err as Error)?.message ?? err}`);
      return [];
    }
  }

  private countryName(cc: string): string | null {
    if (!cc) return null;
    try {
      return this.regionNames?.of(cc) ?? cc;
    } catch {
      return cc;
    }
  }

  /** "Mumbai, India" — omits the country when it would repeat the name. */
  private buildLabel(m: CityRecord): string {
    const cn = this.countryName(m.country);
    return cn && cn.toLowerCase() !== m.name.toLowerCase() ? `${m.name}, ${cn}` : m.name;
  }
}
