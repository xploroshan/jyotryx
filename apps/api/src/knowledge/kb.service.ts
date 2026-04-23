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

export interface KbNumberMeaningPayload {
  planet: string;
  meaning: string;
  strengths: string[];
  cautions: string[];
  colors: string[];
  days: string[];
}

export interface KbBusinessSectorPayload {
  suitable: string[];
  avoid: string[];
}

export interface KbPersonalYearThemePayload {
  theme: string;
  description: string;
  career: string;
  finance: string;
  relationships: string;
  health: string;
}

export interface KbReportSectionPayload {
  title: string;
  content: string;
}

export interface KbZodiacSignPayload {
  name: string;
  element: string;
  modality: string;
  bodyParts: string[];
  guidance: string;
}

export interface KbChineseAnimalPayload {
  traits: string[];
}

export interface KbFlyingStarPayload {
  meaning: string;
}

export interface KbDoshaPayload {
  name: string;
  remedies: string[];
}

export interface KbHellenisticPlanetPayload {
  name: string;
  sectLabel: string;
  joyHouse: string;
  joyDescription: string;
  sectRoleLabel: string;
  description: string;
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
  private numberMeaningCache = new Map<string, KbRow<KbNumberMeaningPayload>>();
  private businessSectorCache = new Map<string, KbRow<KbBusinessSectorPayload>>();
  private personalYearThemeCache = new Map<string, KbRow<KbPersonalYearThemePayload>>();
  private reportSectionCache = new Map<string, KbRow<KbReportSectionPayload>>();
  private zodiacSignCache = new Map<string, KbRow<KbZodiacSignPayload>>();
  private chineseAnimalCache = new Map<string, KbRow<KbChineseAnimalPayload>>();
  private flyingStarCache = new Map<string, KbRow<KbFlyingStarPayload>>();
  private karanaCache = new Map<string, KbRow<KbNamedPayload>>();
  private doshaCache = new Map<string, KbRow<KbDoshaPayload>>();
  private hellenisticPlanetCache = new Map<string, KbRow<KbHellenisticPlanetPayload>>();

  private loaded = {
    planet: false,
    nakshatra: false,
    tithi: false,
    yoga: false,
    vara: false,
    paksha: false,
    professionInsight: false,
    briefingPhrase: false,
    numberMeaning: false,
    businessSector: false,
    personalYearTheme: false,
    reportSection: false,
    zodiacSign: false,
    chineseAnimal: false,
    flyingStar: false,
    karana: false,
    dosha: false,
    hellenisticPlanet: false,
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

  /** Numerology number meaning. Key is the number as a string: "1".."9","11","22","33". */
  async getNumberMeaning(key: string): Promise<KbRow<KbNumberMeaningPayload> | null> {
    await this.ensureLoaded('numberMeaning');
    return this.lookup(this.numberMeaningCache, key, null);
  }

  /** Business-sector mapping per numerology name-number. Key is "1".."9". */
  async getBusinessSector(key: string): Promise<KbRow<KbBusinessSectorPayload> | null> {
    await this.ensureLoaded('businessSector');
    return this.lookup(this.businessSectorCache, key, null);
  }

  /** Personal-year narrative theme per computed year number. Key is "1".."9". */
  async getPersonalYearTheme(key: string): Promise<KbRow<KbPersonalYearThemePayload> | null> {
    await this.ensureLoaded('personalYearTheme');
    return this.lookup(this.personalYearThemeCache, key, null);
  }

  /**
   * Report fallback section. Composite key `"{TYPE}:{order}"` — e.g.
   * `getReportSection("LIFE", 3)` resolves `"LIFE:3"`.
   */
  async getReportSection(type: string, order: number): Promise<KbRow<KbReportSectionPayload> | null> {
    await this.ensureLoaded('reportSection');
    return this.lookup(this.reportSectionCache, `${type}:${order}`, null);
  }

  /**
   * Western zodiac sign. Canonical English key ("Aries".."Pisces"); payload
   * carries name, element, modality, bodyParts and medical guidance — used
   * by medical-body-zodiac today.
   */
  async getZodiacSign(key: string, tradition?: string | null): Promise<KbRow<KbZodiacSignPayload> | null> {
    await this.ensureLoaded('zodiacSign');
    return this.lookup(this.zodiacSignCache, key, tradition);
  }

  /** Chinese zodiac animal. Key is the animal name, e.g. "Rat".."Pig". */
  async getChineseAnimal(key: string): Promise<KbRow<KbChineseAnimalPayload> | null> {
    await this.ensureLoaded('chineseAnimal');
    return this.lookup(this.chineseAnimalCache, key, null);
  }

  /** Feng Shui Flying Star. Key is the star number as a string: "1".."9". */
  async getFlyingStar(key: string): Promise<KbRow<KbFlyingStarPayload> | null> {
    await this.ensureLoaded('flyingStar');
    return this.lookup(this.flyingStarCache, key, null);
  }

  /** Panchang Karana (half-tithi). Key is the canonical name, e.g. "Bava". */
  async getKarana(key: string): Promise<KbRow<KbNamedPayload> | null> {
    await this.ensureLoaded('karana');
    return this.lookup(this.karanaCache, key, null);
  }

  /**
   * Vedic dosha. Key is the dosha identifier: "mangal" | "kaal_sarp" |
   * "nadi" | "pitra". Payload carries the localized name + 4-item
   * remedies list; per-chart descriptions are looked up separately via
   * `dosha.{key}.{branch}` briefing phrases.
   */
  async getDosha(key: string): Promise<KbRow<KbDoshaPayload> | null> {
    await this.ensureLoaded('dosha');
    return this.lookup(this.doshaCache, key, null);
  }

  /**
   * Hellenistic sect-aware planet overlay. Key is the canonical English
   * planet name ("Sun".."Saturn"). Payload carries the localized sect
   * label, house of joy, sect role, and prose description — used by the
   * Hellenistic endpoints in astrology.service.ts to enrich lord-of-year
   * / major- and minor-period lords / ascendant lord.
   */
  async getHellenisticPlanet(key: string): Promise<KbRow<KbHellenisticPlanetPayload> | null> {
    await this.ensureLoaded('hellenisticPlanet');
    return this.lookup(this.hellenisticPlanetCache, key, null);
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
    this.numberMeaningCache.clear();
    this.businessSectorCache.clear();
    this.personalYearThemeCache.clear();
    this.reportSectionCache.clear();
    this.zodiacSignCache.clear();
    this.chineseAnimalCache.clear();
    this.flyingStarCache.clear();
    this.karanaCache.clear();
    this.doshaCache.clear();
    this.hellenisticPlanetCache.clear();
    this.loaded = {
      planet: false, nakshatra: false, tithi: false, yoga: false,
      vara: false, paksha: false, professionInsight: false, briefingPhrase: false,
      numberMeaning: false, businessSector: false, personalYearTheme: false,
      reportSection: false, zodiacSign: false, chineseAnimal: false,
      flyingStar: false, karana: false, dosha: false, hellenisticPlanet: false,
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
        case 'numberMeaning':     await this.loadNumberMeanings();     break;
        case 'businessSector':    await this.loadBusinessSectors();    break;
        case 'personalYearTheme': await this.loadPersonalYearThemes(); break;
        case 'reportSection':     await this.loadReportSections();     break;
        case 'zodiacSign':        await this.loadZodiacSigns();        break;
        case 'chineseAnimal':     await this.loadChineseAnimals();     break;
        case 'flyingStar':        await this.loadFlyingStars();        break;
        case 'karana':            await this.loadKaranas();            break;
        case 'dosha':             await this.loadDoshas();             break;
        case 'hellenisticPlanet': await this.loadHellenisticPlanets(); break;
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
  private async loadNumberMeanings(): Promise<void> {
    const model: any = (this.prisma as any).kbNumberMeaning;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.numberMeaningCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadBusinessSectors(): Promise<void> {
    const model: any = (this.prisma as any).kbBusinessSector;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.businessSectorCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadPersonalYearThemes(): Promise<void> {
    const model: any = (this.prisma as any).kbPersonalYearTheme;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.personalYearThemeCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadReportSections(): Promise<void> {
    const model: any = (this.prisma as any).kbReportSection;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.reportSectionCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadZodiacSigns(): Promise<void> {
    const model: any = (this.prisma as any).kbZodiacSign;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.zodiacSignCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadChineseAnimals(): Promise<void> {
    const model: any = (this.prisma as any).kbChineseAnimal;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.chineseAnimalCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadFlyingStars(): Promise<void> {
    const model: any = (this.prisma as any).kbFlyingStar;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.flyingStarCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadKaranas(): Promise<void> {
    const model: any = (this.prisma as any).kbKarana;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.karanaCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadDoshas(): Promise<void> {
    const model: any = (this.prisma as any).kbDosha;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.doshaCache.set(cacheKey(r.key, r.tradition), r as any);
  }
  private async loadHellenisticPlanets(): Promise<void> {
    const model: any = (this.prisma as any).kbHellenisticPlanet;
    if (!model?.findMany) return;
    const rows = await model.findMany();
    for (const r of rows) this.hellenisticPlanetCache.set(cacheKey(r.key, r.tradition), r as any);
  }
}

function cacheKey(key: string, tradition: string | null | undefined): string {
  return `${key}::${tradition ?? ''}`;
}

// Re-export so callers don't have to reach into `./kb-locales` directly.
export { tr, trStatus } from './kb-locales';
export type { LocaleBag, KbLocale } from './kb-locales';
