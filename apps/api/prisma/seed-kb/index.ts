/**
 * Typed loader for the Kb* seed data files under `data/`.
 *
 * The JSON files are the source of truth — `backfill-locales.ts` edits
 * them in place to add missing locales, and they are replayed into the
 * database by `prisma/seed.ts`. This wrapper:
 *
 *   1. Provides strongly-typed `SEED_TABLES` consumed by `seed.ts` for
 *      the actual upsert loop.
 *   2. Provides a plain, untyped export consumed by the integrity test
 *      at `apps/api/src/knowledge/__tests__/integrity.spec.ts` once the
 *      backfill has brought every row to full 12-locale coverage.
 *
 * Keep table names here in sync with the Prisma model map names (e.g.
 * `kb_planets`). Seed files not listed in `SEED_TABLES` are ignored.
 */
import * as planetsData from './data/planets.json';
import * as nakshatrasData from './data/nakshatras.json';
import * as tithisData from './data/tithis.json';
import * as yogasData from './data/yogas.json';
import * as varasData from './data/varas.json';
import * as pakshasData from './data/pakshas.json';
import * as professionInsightsData from './data/profession-insights.json';
import * as briefingPhrasesData from './data/briefing-phrases.json';
import * as numberMeaningsData from './data/number-meanings.json';
import * as businessSectorsData from './data/business-sectors.json';
import * as personalYearThemesData from './data/personal-year-themes.json';
import * as reportSectionsData from './data/report-sections.json';
import * as zodiacSignsData from './data/zodiac-signs.json';
import * as chineseAnimalsData from './data/chinese-animals.json';
import * as flyingStarsData from './data/flying-stars.json';
import * as karanasData from './data/karanas.json';
import * as doshasData from './data/doshas.json';
import * as hellenisticPlanetsData from './data/hellenistic-planets.json';
import * as dashaImpactsData from './data/dasha-impacts.json';
import * as matchingTiersData from './data/matching-tiers.json';
import * as signTraitsData from './data/sign-traits.json';
import * as planetInHouseData from './data/planet-in-house.json';
import * as houseMeaningData from './data/house-meaning.json';
import * as planetInSignData from './data/planet-in-sign.json';
import * as yogaMeaningData from './data/yoga-meaning.json';
import * as kootaMeaningData from './data/koota-meaning.json';
import * as aspectMeaningData from './data/aspect-meaning.json';
import * as transitAlertData from './data/transit-alert.json';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface RawSeedRow {
  key: string;
  tradition: string | null;
  i18n: Record<string, Record<string, JsonValue>>;
}

export interface SeedTable {
  /** Prisma model name on PrismaService, e.g. "kbPlanet". */
  modelName:
    | 'kbPlanet'
    | 'kbNakshatra'
    | 'kbTithi'
    | 'kbYoga'
    | 'kbVara'
    | 'kbPaksha'
    | 'kbProfessionInsight'
    | 'kbBriefingPhrase'
    | 'kbNumberMeaning'
    | 'kbBusinessSector'
    | 'kbPersonalYearTheme'
    | 'kbReportSection'
    | 'kbZodiacSign'
    | 'kbChineseAnimal'
    | 'kbFlyingStar'
    | 'kbKarana'
    | 'kbDosha'
    | 'kbHellenisticPlanet'
    | 'kbDashaImpact'
    | 'kbMatchingTier'
    | 'kbSignTrait'
    | 'kbPlanetInHouse'
    | 'kbHouseMeaning'
    | 'kbPlanetInSign'
    | 'kbYogaMeaning'
    | 'kbKootaMeaning'
    | 'kbAspectMeaning'
    | 'kbTransitAlert';
  /** Compound-unique index key for upsert `where`. */
  uniqueKey:
    | 'kb_planets_key_tradition_key'
    | 'kb_nakshatras_key_tradition_key'
    | 'kb_tithis_key_tradition_key'
    | 'kb_yogas_key_tradition_key'
    | 'kb_varas_key_tradition_key'
    | 'kb_pakshas_key_tradition_key'
    | 'kb_profession_insights_key_tradition_key'
    | 'kb_briefing_phrases_key_tradition_key'
    | 'kb_number_meanings_key_tradition_key'
    | 'kb_business_sectors_key_tradition_key'
    | 'kb_personal_year_themes_key_tradition_key'
    | 'kb_report_sections_key_tradition_key'
    | 'kb_zodiac_signs_key_tradition_key'
    | 'kb_chinese_animals_key_tradition_key'
    | 'kb_flying_stars_key_tradition_key'
    | 'kb_karanas_key_tradition_key'
    | 'kb_doshas_key_tradition_key'
    | 'kb_hellenistic_planets_key_tradition_key'
    | 'kb_dasha_impacts_key_tradition_key'
    | 'kb_matching_tiers_key_tradition_key'
    | 'kb_sign_traits_key_tradition_key'
    | 'kb_planet_in_house_key_tradition_key'
    | 'kb_house_meaning_key_tradition_key'
    | 'kb_planet_in_sign_key_tradition_key'
    | 'kb_yoga_meaning_key_tradition_key'
    | 'kb_koota_meaning_key_tradition_key'
    | 'kb_aspect_meaning_key_tradition_key'
    | 'kb_transit_alert_key_tradition_key';
  /** On-disk path relative to this file (for backfill rewrites). */
  dataFile: string;
  /** Loaded rows. */
  rows: RawSeedRow[];
}

// `import * as` wraps a JSON module; unwrap `.rows` off each.
function rowsOf(mod: any): RawSeedRow[] {
  return (mod.rows ?? mod.default?.rows ?? []) as RawSeedRow[];
}

export const SEED_TABLES: readonly SeedTable[] = [
  {
    modelName: 'kbPlanet',
    uniqueKey: 'kb_planets_key_tradition_key',
    dataFile: 'data/planets.json',
    rows: rowsOf(planetsData),
  },
  {
    modelName: 'kbNakshatra',
    uniqueKey: 'kb_nakshatras_key_tradition_key',
    dataFile: 'data/nakshatras.json',
    rows: rowsOf(nakshatrasData),
  },
  {
    modelName: 'kbTithi',
    uniqueKey: 'kb_tithis_key_tradition_key',
    dataFile: 'data/tithis.json',
    rows: rowsOf(tithisData),
  },
  {
    modelName: 'kbYoga',
    uniqueKey: 'kb_yogas_key_tradition_key',
    dataFile: 'data/yogas.json',
    rows: rowsOf(yogasData),
  },
  {
    modelName: 'kbVara',
    uniqueKey: 'kb_varas_key_tradition_key',
    dataFile: 'data/varas.json',
    rows: rowsOf(varasData),
  },
  {
    modelName: 'kbPaksha',
    uniqueKey: 'kb_pakshas_key_tradition_key',
    dataFile: 'data/pakshas.json',
    rows: rowsOf(pakshasData),
  },
  {
    modelName: 'kbProfessionInsight',
    uniqueKey: 'kb_profession_insights_key_tradition_key',
    dataFile: 'data/profession-insights.json',
    rows: rowsOf(professionInsightsData),
  },
  {
    modelName: 'kbBriefingPhrase',
    uniqueKey: 'kb_briefing_phrases_key_tradition_key',
    dataFile: 'data/briefing-phrases.json',
    rows: rowsOf(briefingPhrasesData),
  },
  {
    modelName: 'kbNumberMeaning',
    uniqueKey: 'kb_number_meanings_key_tradition_key',
    dataFile: 'data/number-meanings.json',
    rows: rowsOf(numberMeaningsData),
  },
  {
    modelName: 'kbBusinessSector',
    uniqueKey: 'kb_business_sectors_key_tradition_key',
    dataFile: 'data/business-sectors.json',
    rows: rowsOf(businessSectorsData),
  },
  {
    modelName: 'kbPersonalYearTheme',
    uniqueKey: 'kb_personal_year_themes_key_tradition_key',
    dataFile: 'data/personal-year-themes.json',
    rows: rowsOf(personalYearThemesData),
  },
  {
    modelName: 'kbReportSection',
    uniqueKey: 'kb_report_sections_key_tradition_key',
    dataFile: 'data/report-sections.json',
    rows: rowsOf(reportSectionsData),
  },
  {
    modelName: 'kbZodiacSign',
    uniqueKey: 'kb_zodiac_signs_key_tradition_key',
    dataFile: 'data/zodiac-signs.json',
    rows: rowsOf(zodiacSignsData),
  },
  {
    modelName: 'kbChineseAnimal',
    uniqueKey: 'kb_chinese_animals_key_tradition_key',
    dataFile: 'data/chinese-animals.json',
    rows: rowsOf(chineseAnimalsData),
  },
  {
    modelName: 'kbFlyingStar',
    uniqueKey: 'kb_flying_stars_key_tradition_key',
    dataFile: 'data/flying-stars.json',
    rows: rowsOf(flyingStarsData),
  },
  {
    modelName: 'kbKarana',
    uniqueKey: 'kb_karanas_key_tradition_key',
    dataFile: 'data/karanas.json',
    rows: rowsOf(karanasData),
  },
  {
    modelName: 'kbDosha',
    uniqueKey: 'kb_doshas_key_tradition_key',
    dataFile: 'data/doshas.json',
    rows: rowsOf(doshasData),
  },
  {
    modelName: 'kbHellenisticPlanet',
    uniqueKey: 'kb_hellenistic_planets_key_tradition_key',
    dataFile: 'data/hellenistic-planets.json',
    rows: rowsOf(hellenisticPlanetsData),
  },
  {
    modelName: 'kbDashaImpact',
    uniqueKey: 'kb_dasha_impacts_key_tradition_key',
    dataFile: 'data/dasha-impacts.json',
    rows: rowsOf(dashaImpactsData),
  },
  {
    modelName: 'kbMatchingTier',
    uniqueKey: 'kb_matching_tiers_key_tradition_key',
    dataFile: 'data/matching-tiers.json',
    rows: rowsOf(matchingTiersData),
  },
  {
    modelName: 'kbSignTrait',
    uniqueKey: 'kb_sign_traits_key_tradition_key',
    dataFile: 'data/sign-traits.json',
    rows: rowsOf(signTraitsData),
  },
  {
    modelName: 'kbPlanetInHouse',
    uniqueKey: 'kb_planet_in_house_key_tradition_key',
    dataFile: 'data/planet-in-house.json',
    rows: rowsOf(planetInHouseData),
  },
  {
    modelName: 'kbHouseMeaning',
    uniqueKey: 'kb_house_meaning_key_tradition_key',
    dataFile: 'data/house-meaning.json',
    rows: rowsOf(houseMeaningData),
  },
  {
    modelName: 'kbPlanetInSign',
    uniqueKey: 'kb_planet_in_sign_key_tradition_key',
    dataFile: 'data/planet-in-sign.json',
    rows: rowsOf(planetInSignData),
  },
  {
    modelName: 'kbYogaMeaning',
    uniqueKey: 'kb_yoga_meaning_key_tradition_key',
    dataFile: 'data/yoga-meaning.json',
    rows: rowsOf(yogaMeaningData),
  },
  {
    modelName: 'kbKootaMeaning',
    uniqueKey: 'kb_koota_meaning_key_tradition_key',
    dataFile: 'data/koota-meaning.json',
    rows: rowsOf(kootaMeaningData),
  },
  {
    modelName: 'kbAspectMeaning',
    uniqueKey: 'kb_aspect_meaning_key_tradition_key',
    dataFile: 'data/aspect-meaning.json',
    rows: rowsOf(aspectMeaningData),
  },
  {
    modelName: 'kbTransitAlert',
    uniqueKey: 'kb_transit_alert_key_tradition_key',
    dataFile: 'data/transit-alert.json',
    rows: rowsOf(transitAlertData),
  },
];
