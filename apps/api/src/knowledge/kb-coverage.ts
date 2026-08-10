/**
 * KB locale-coverage tracking.
 *
 * `tr()` — and therefore `KbService.render()` — silently falls back to
 * English when a row has no entry for the requested locale. That is the
 * correct RUNTIME behaviour (serving English beats serving nothing), but it
 * makes the gap invisible: with 62 `render()` call sites and only 9 using
 * `renderStatus().matched`, there was no way to answer "how much of the KB
 * actually exists in Tamil?" or "which rows still need backfilling?".
 *
 * Rather than convert all 62 call sites — each of which would have to decide
 * what to DO on a miss, a large refactor with real regression risk — this
 * records every render outcome centrally. Behaviour is unchanged; the misses
 * simply stop being invisible.
 *
 * Deliberately in-memory and bounded:
 *   - counters are cheap and reset on deploy, which is fine for "is the
 *     backfill working" style questions;
 *   - the missing-key sample is capped so a cold cache in an unbackfilled
 *     locale cannot grow this without limit.
 */

import { isKbLocale } from './kb-locales';

/** Cap on distinct missing keys retained per locale. */
const MAX_SAMPLE_KEYS_PER_LOCALE = 50;

export interface LocaleCoverage {
  locale: string;
  hits: number;
  misses: number;
  /** hits / (hits + misses), rounded to 3 dp. 1 = fully backfilled so far. */
  coverage: number;
  /** Bounded sample of row keys that fell back to English. */
  sampleMissingKeys: string[];
}

export interface KbCoverageReport {
  totalRenders: number;
  totalMisses: number;
  byLocale: LocaleCoverage[];
  truncated: boolean;
}

export class KbCoverageTracker {
  private readonly hits = new Map<string, number>();
  private readonly misses = new Map<string, number>();
  private readonly missingKeys = new Map<string, Set<string>>();
  private truncated = false;

  record(locale: string | null | undefined, key: string, matched: boolean): void {
    // English (and locale-less) requests are the baseline, not coverage
    // signal — counting them would dilute every ratio toward 1.
    const l = (locale ?? 'en').toLowerCase();
    if (l === 'en') return;

    // UNBOUNDED-GROWTH GUARD. `locale` reaches here straight from query
    // strings on public endpoints (e.g. the @Public() GET
    // /astrology/medical/body-zodiac takes a raw ?locale=). Without this
    // check every distinct value permanently allocated a Map entry and a Set,
    // so an unauthenticated caller could grow the heap without limit — and
    // then have GET /knowledge/coverage sort and serialise all of it. The
    // closed 12-locale set bounds both by construction.
    if (!isKbLocale(l)) return;

    if (matched) {
      this.hits.set(l, (this.hits.get(l) ?? 0) + 1);
      return;
    }

    this.misses.set(l, (this.misses.get(l) ?? 0) + 1);
    let keys = this.missingKeys.get(l);
    if (!keys) {
      keys = new Set<string>();
      this.missingKeys.set(l, keys);
    }
    if (keys.size < MAX_SAMPLE_KEYS_PER_LOCALE) keys.add(key);
    else this.truncated = true;
  }

  report(): KbCoverageReport {
    const locales = new Set([...this.hits.keys(), ...this.misses.keys()]);
    const byLocale: LocaleCoverage[] = [...locales]
      .map((locale) => {
        const hits = this.hits.get(locale) ?? 0;
        const misses = this.misses.get(locale) ?? 0;
        const total = hits + misses;
        return {
          locale,
          hits,
          misses,
          coverage: total === 0 ? 0 : Math.round((hits / total) * 1000) / 1000,
          sampleMissingKeys: [...(this.missingKeys.get(locale) ?? [])].sort(),
        };
      })
      .sort((a, b) => a.coverage - b.coverage || a.locale.localeCompare(b.locale));

    return {
      totalRenders: byLocale.reduce((n, l) => n + l.hits + l.misses, 0),
      totalMisses: byLocale.reduce((n, l) => n + l.misses, 0),
      byLocale,
      truncated: this.truncated,
    };
  }

  reset(): void {
    this.hits.clear();
    this.misses.clear();
    this.missingKeys.clear();
    this.truncated = false;
  }
}
