import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocaleBag, tr, trStatus, KbLocale } from './kb-locales';

// ─── Per-table i18n payload shapes ──────────────────────────────────────────
// These are the authoritative shapes the integrity test asserts against.

export interface KbPlanetPayload {
  name: string;
  color: string;
  remedy: string;
  mantra: string;
  doList: string[];
  avoidList: string[];
}

export interface KbNakshatraPayload {
  name: string;
  quality: string;
}

export interface KbNamedPayload {
  name: string;
}

export interface KbProfessionInsightPayload {
  insight: string;
}

export interface KbBriefingPhrasePayload {
  text: string;
}

interface KbRow<Payload> {
  id: string;
  key: string;
  tradition: string | null;
  i18n: LocaleBag<Payload>;
}

/**
 * Facade over the Kb* Prisma tables.
 *
 * Lookups are keyed by the canonical English identifier (e.g. "Sun",
 * "Ashwini") and optionally scoped by tradition. Shared rows
 * (tradition IS NULL) are returned when no tradition-specific row
 * exists, so callers can pass a tradition unconditionally.
 *
 * All lookups are cached in-memory on first hit — Kb* data is tiny
 * (low hundreds of rows across all tables) and mutates only during
 * seed runs, so the cache is effectively the hot path.
 */
@Injectable()
export class KbService {
  private readonly logger = new Logger(KbService.name);

  private planetCache = new Map<string, KbRow<KbPlanetPayload>>();
  private nakshatraCache = new Map<string, KbRow<KbNakshatraPayload>>();
  private tithiCache = new Map<string, KbRow<KbNamedPayload>>();
  private yogaCache = new Map<string, KbRow<KbNamedPayload>>();
  private varaCache = new Map<string, KbRow<KbNamedPayload>>();
  private pakshaCache = new Map<string, KbRow<KbNamedPayload>>();
  private professionInsightCache = new Map<string, KbRow<KbProfessionInsightPayload>>();
  private briefingPhraseCache = new Map<string, KbRow<KbBriefingPhrasePayload>>();

  private loaded = {
    planet: false,
    nakshatra: false,
    tithi: false,
    yoga: false,
    vara: false,
    paksha: false,
    professionInsight: false,
    briefingPhrase: false,
  };

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ─────────────────────────────────────────────────────────

  async getPlanet(key: string, tradition?: string | null): Promise<KbRow<KbPlanetPayload> | null> {
    await this.ensureLoaded('planet');
    return this.lookup(this.planetCache, key, tradition);
  }

  async getNakshatra(key: string, tradition?: string | null): Promise<KbRow<KbNakshatraPayload> | null> {
    await this.ensureLoaded('nakshatra');
    return this.lookup(this.nakshatraCache, key, tradition);
  }

  async getTithi(key: string): Promise<KbRow<KbNamedPayload> | null> {
    await this.ensureLoaded('tithi');
    return this.lookup(this.tithiCache, key, null);
  }

  async getYoga(key: string): Promise<KbRow<KbNamedPayload> | null> {
    await this.ensureLoaded('yoga');
    return this.lookup(this.yogaCache, key, null);
  }

  async getVara(key: string): Promise<KbRow<KbNamedPayload> | null> {
    await this.ensureLoaded('vara');
    return this.lookup(this.varaCache, key, null);
  }

  async getPaksha(key: string): Promise<KbRow<KbNamedPayload> | null> {
    await this.ensureLoaded('paksha');
    return this.lookup(this.pakshaCache, key, null);
  }

  /**
   * Look up a per-profession × planet insight. Composite key format
   * `"{PROFESSION}:{Planet}"` — e.g. `getProfessionInsight("SOFTWARE", "Sun")`
   * resolves `SOFTWARE:Sun`.
   */
  async getProfessionInsight(
    profession: string,
    planet: string,
  ): Promise<KbRow<KbProfessionInsightPayload> | null> {
    await this.ensureLoaded('professionInsight');
    return this.lookup(this.professionInsightCache, `${profession}:${planet}`, null);
  }

  /** Look up a UI phrase by key, e.g. "greeting.morning" or "quality.good". */
  async getBriefingPhrase(key: string): Promise<KbRow<KbBriefingPhrasePayload> | null> {
    await this.ensureLoaded('briefingPhrase');
    return this.lookup(this.briefingPhraseCache, key, null);
  }

  /** Convenience: render a KB row in the user's locale, falling back to English. */
  render<T>(row: KbRow<T> | null, locale?: string | null): T | null {
    if (!row) return null;
    return tr(row.i18n, locale);
  }

  /** Like `render` but reports whether the locale was an exact hit. */
  renderStatus<T>(row: KbRow<T> | null, locale?: string | null): { value: T; matched: boolean } | null {
    if (!row) return null;
    return trStatus(row.i18n, locale);
  }

  /** Invalidate all caches. Called after seed runs or admin updates. */
  invalidate(): void {
    this.planetCache.clear();
    this.nakshatraCache.clear();
    this.tithiCache.clear();
    this.yogaCache.clear();
    this.varaCache.clear();
    this.pakshaCache.clear();
    this.professionInsightCache.clear();
    this.briefingPhraseCache.clear();
    this.loaded = {
      planet: false, nakshatra: false, tithi: false, yoga: false,
      vara: false, paksha: false, professionInsight: false, briefingPhrase: false,
    };
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  private lookup<T>(cache: Map<string, KbRow<T>>, key: string, tradition?: string | null): KbRow<T> | null {
    if (tradition) {
      const scoped = cache.get(cacheKey(key, tradition));
      if (scoped) return scoped;
    }
    return cache.get(cacheKey(key, null)) ?? null;
  }

  private async ensureLoaded(table: keyof typeof this.loaded): Promise<void> {
    if (this.loaded[table]) return;
    try {
      switch (table) {
        case 'planet':            await this.loadPlanets();            break;
        case 'nakshatra':         await this.loadNakshatras();         break;
        case 'tithi':             await this.loadTithis();             break;
        case 'yoga':              await this.loadYogas();              break;
        case 'vara':              await this.loadVaras();              break;
        case 'paksha':            await this.loadPakshas();            break;
        case 'professionInsight': await this.loadProfessionInsights(); break;
        case 'briefingPhrase':    await this.loadBriefingPhrases();    break;
      }
      this.loaded[table] = true;
    } catch (err) {
      // DB unavailable or migration not applied yet — fail open. Callers
      // treat a null lookup as "not in KB, fall back to legacy path".
      this.logger.warn(`KB ${table} load failed: ${(err as Error).message}`);
    }
  }

  private async loadPlanets(): Promise<void> {
    const rows = await this.prisma.kbPlanet.findMany();
    for (const r of rows) this.planetCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadNakshatras(): Promise<void> {
    const rows = await this.prisma.kbNakshatra.findMany();
    for (const r of rows) this.nakshatraCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadTithis(): Promise<void> {
    const rows = await this.prisma.kbTithi.findMany();
    for (const r of rows) this.tithiCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadYogas(): Promise<void> {
    const rows = await this.prisma.kbYoga.findMany();
    for (const r of rows) this.yogaCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadVaras(): Promise<void> {
    const rows = await this.prisma.kbVara.findMany();
    for (const r of rows) this.varaCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadPakshas(): Promise<void> {
    const rows = await this.prisma.kbPaksha.findMany();
    for (const r of rows) this.pakshaCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadProfessionInsights(): Promise<void> {
    const model: any = (this.prisma as any).kbProfessionInsight;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.professionInsightCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadBriefingPhrases(): Promise<void> {
    const model: any = (this.prisma as any).kbBriefingPhrase;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.briefingPhraseCache.set(cacheKey(r.key, r.tradition), r as any);
  }
}

function cacheKey(key: string, tradition: string | null | undefined): string {
  return `${key}::${tradition ?? ''}`;
}

// Re-export so callers don't have to reach into `./kb-locales` directly.
export { tr, trStatus } from './kb-locales';
export type { LocaleBag, KbLocale } from './kb-locales';
