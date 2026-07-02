import type { FieldSpec } from './types';
import { FeatureSpec, asResult, dobField as dob, tobField as tob, pobField as pob, latField as latOpt, lngField as lngOpt } from './spec';
import { VEDIC_REQUESTS } from './requests';
import {
  ZODIAC_SIGNS,
  HOROSCOPE_PERIODS,
  MUHURAT_PURPOSES,
  ELECTIONAL_ACTIVITIES,
  TAROT_SPREADS,
  VASTU_PROPERTY_TYPES,
  VASTU_DIRECTIONS,
  DIVISIONAL_TYPES,
  NUMEROLOGY_MODES,
  CITY_OPTIONS,
} from './constants';
import { KundliResult, DashaResult, DoshaResult, DivisionalResult, KpResult, MatchingResult } from './results/birthChart';
import { HoroscopeResult, PanchangResult, MuhuratResult, CosmicResult, DecisionResult } from './results/timeCalendar';
import { NumerologyResult, MulankResult, TarotResult, VastuResult } from './results/misc';

export type { FeatureSpec } from './spec';

const activity: FieldSpec = { key: 'activity', label: 'Activity', type: 'select', options: ELECTIONAL_ACTIVITIES, default: 'general' };
const cityField: FieldSpec = { key: 'city', label: 'City', type: 'select', options: CITY_OPTIONS, default: '0' };

const CUR_YEAR = String(new Date().getFullYear());
const CUR_MONTH = String(new Date().getMonth() + 1);
const MONTHS: FieldSpec = {
  key: 'month',
  label: 'Month',
  type: 'select',
  default: CUR_MONTH,
  options: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => ({
    value: String(i + 1),
    label: m,
  })),
};

export const VEDIC_FEATURES: Record<string, FeatureSpec> = {
  kundli: {
    slug: 'kundli',
    title: 'Kundli',
    subtitle: 'Your Vedic birth chart',
    gate: 'credit',
    featureKey: 'kundli',
    submitLabel: 'Generate chart',
    fields: [dob, tob, pob],
    build: VEDIC_REQUESTS.kundli!,
    Result: asResult(KundliResult),
    domain: 'kundli',
    interpretationPayload: (d: never) => {
      const k = d as import('./results/responses').KundliData;
      return {
        ascendant: k.ascendant,
        moonSign: k.moonSign,
        sunSign: k.sunSign,
        nakshatra: k.nakshatra,
        planets: (k.planetaryPositions ?? []).slice(0, 9).map((p) => ({ planet: p.planet, sign: p.sign, house: p.house })),
        yogas: (k.yogas ?? []).map((y) => y.name),
        currentMahadasha: k.dashas?.[0]?.planet,
      };
    },
  },

  dasha: {
    slug: 'dasha',
    title: 'Dasha',
    subtitle: 'Vimshottari planetary periods',
    gate: 'credit',
    featureKey: 'dasha',
    autoRun: true,
    requiresBirthProfile: true,
    fields: [],
    build: VEDIC_REQUESTS.dasha!,
    Result: asResult(DashaResult),
    domain: 'dasha',
  },

  dosha: {
    slug: 'dosha',
    title: 'Dosha',
    subtitle: 'Afflictions & remedies',
    gate: 'credit',
    featureKey: 'dosha',
    autoRun: true,
    requiresBirthProfile: true,
    fields: [],
    build: VEDIC_REQUESTS.dosha!,
    Result: asResult(DoshaResult),
    domain: 'dosha',
  },

  divisional: {
    slug: 'divisional',
    title: 'Divisional charts',
    subtitle: 'Varga charts (D9 / D10)',
    gate: 'credit',
    featureKey: 'divisional',
    submitLabel: 'Generate',
    fields: [{ key: 'chartType', label: 'Chart', type: 'select', options: DIVISIONAL_TYPES, default: '9' }, dob, tob, pob, latOpt, lngOpt],
    build: VEDIC_REQUESTS.divisional!,
    Result: asResult(DivisionalResult),
    domain: 'divisional',
  },

  'kp-astrology': {
    slug: 'kp-astrology',
    title: 'KP astrology',
    subtitle: 'Krishnamurti Paddhati',
    gate: 'credit',
    featureKey: 'kp',
    submitLabel: 'Generate',
    fields: [dob, tob, pob, latOpt, lngOpt],
    build: VEDIC_REQUESTS['kp-astrology']!,
    Result: asResult(KpResult),
    domain: 'kp',
  },

  matching: {
    slug: 'matching',
    title: 'Matching',
    subtitle: 'Ashtakoota compatibility',
    gate: 'credit',
    featureKey: 'matching',
    submitLabel: 'Check compatibility',
    fields: [
      { key: 'a_dob', label: 'Person A · date of birth', type: 'date', required: true, prefillFromProfile: 'dateOfBirth' },
      { key: 'a_tob', label: 'Person A · time of birth', type: 'time', required: true, prefillFromProfile: 'timeOfBirth' },
      { key: 'a_pob', label: 'Person A · place of birth', type: 'place', required: true, prefillFromProfile: 'placeOfBirth' },
      { key: 'b_dob', label: 'Person B · date of birth', type: 'date', required: true },
      { key: 'b_tob', label: 'Person B · time of birth', type: 'time', required: true },
      { key: 'b_pob', label: 'Person B · place of birth', type: 'place', required: true },
    ],
    build: VEDIC_REQUESTS.matching!,
    Result: asResult(MatchingResult),
    domain: 'matching',
  },

  horoscope: {
    slug: 'horoscope',
    title: 'Horoscope',
    gate: 'free',
    featureKey: 'horoscope',
    autoRun: true,
    submitLabel: 'View',
    fields: [
      { key: 'sign', label: 'Sign', type: 'select', default: 'aries', options: ZODIAC_SIGNS.map((s) => ({ value: s.id, label: `${s.glyph} ${s.label}` })) },
      { key: 'period', label: 'Period', type: 'select', default: 'daily', options: HOROSCOPE_PERIODS },
    ],
    build: VEDIC_REQUESTS.horoscope!,
    Result: asResult(HoroscopeResult),
  },

  panchang: {
    slug: 'panchang',
    title: 'Panchang',
    subtitle: "Today's almanac",
    gate: 'free',
    featureKey: 'panchang',
    autoRun: true,
    fields: [],
    build: VEDIC_REQUESTS.panchang!,
    Result: asResult(PanchangResult),
  },

  muhurat: {
    slug: 'muhurat',
    title: 'Muhurat',
    subtitle: 'Auspicious timing',
    gate: 'credit',
    featureKey: 'muhurat',
    submitLabel: 'Find times',
    fields: [
      { key: 'purpose', label: 'Purpose', type: 'select', options: MUHURAT_PURPOSES, default: 'marriage' },
      { key: 'fromDate', label: 'From', type: 'date', required: true },
      { key: 'toDate', label: 'To', type: 'date', required: true },
      { key: 'location', label: 'Location', type: 'place', required: true },
    ],
    build: VEDIC_REQUESTS.muhurat!,
    Result: asResult(MuhuratResult),
    domain: 'muhurat',
  },

  'cosmic-calendar': {
    slug: 'cosmic-calendar',
    title: 'Cosmic Calendar',
    subtitle: 'Best days for an activity',
    gate: 'free',
    featureKey: 'cosmic-calendar',
    autoRun: true,
    submitLabel: 'View month',
    fields: [activity, cityField, { key: 'year', label: 'Year', type: 'number', default: CUR_YEAR }, MONTHS],
    build: VEDIC_REQUESTS['cosmic-calendar']!,
    Result: asResult(CosmicResult),
  },

  'decision-room': {
    slug: 'decision-room',
    title: 'Decision Room',
    subtitle: 'Time a specific decision',
    gate: 'credit',
    featureKey: 'decision-room',
    submitLabel: 'Evaluate',
    fields: [activity, { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'time', label: 'Time', type: 'time', optional: true }, cityField],
    build: VEDIC_REQUESTS['decision-room']!,
    Result: asResult(DecisionResult),
    domain: 'decision',
  },

  numerology: {
    slug: 'numerology',
    title: 'Numerology',
    gate: 'free',
    featureKey: 'numerology',
    submitLabel: 'Analyse',
    fields: [
      { key: 'mode', label: 'Mode', type: 'select', options: NUMEROLOGY_MODES, default: 'name' },
      { key: 'name', label: 'Full name', type: 'text', required: true, showIf: (v) => (v.mode ?? 'name') === 'name' },
      { key: 'brandName', label: 'Brand / business name', type: 'text', required: true, showIf: (v) => v.mode === 'brand' },
      { key: 'dob', label: 'Date of birth', type: 'date', required: true, prefillFromProfile: 'dateOfBirth', showIf: (v) => v.mode === 'personal-year' },
    ],
    build: VEDIC_REQUESTS.numerology!,
    Result: asResult(NumerologyResult),
  },

  mulank: {
    slug: 'mulank',
    title: 'Mulank',
    subtitle: 'Your root number',
    gate: 'free',
    featureKey: 'mulank',
    autoRun: true,
    requiresBirthProfile: true,
    fields: [],
    build: VEDIC_REQUESTS.mulank!,
    Result: asResult(MulankResult),
  },

  tarot: {
    slug: 'tarot',
    title: 'Tarot',
    gate: 'credit',
    featureKey: 'tarot',
    submitLabel: 'Draw cards',
    fields: [
      { key: 'spread', label: 'Spread', type: 'select', options: TAROT_SPREADS, default: 'single' },
      { key: 'question', label: 'Question', type: 'text', optional: true, placeholder: 'What should I focus on?' },
    ],
    build: VEDIC_REQUESTS.tarot!,
    Result: asResult(TarotResult),
  },

  vastu: {
    slug: 'vastu',
    title: 'Vastu',
    subtitle: 'Space & direction analysis',
    gate: 'credit',
    featureKey: 'vastu',
    submitLabel: 'Analyse',
    fields: [
      { key: 'propertyType', label: 'Property type', type: 'select', options: VASTU_PROPERTY_TYPES, default: 'house' },
      { key: 'entranceDirection', label: 'Entrance faces', type: 'select', options: VASTU_DIRECTIONS, default: 'E' },
      { key: 'concern', label: 'Concern', type: 'text', optional: true, placeholder: 'e.g. finances, health' },
    ],
    build: VEDIC_REQUESTS.vastu!,
    Result: asResult(VastuResult),
  },
};

export function getVedicFeature(slug: string): FeatureSpec | null {
  return VEDIC_FEATURES[slug] ?? null;
}
