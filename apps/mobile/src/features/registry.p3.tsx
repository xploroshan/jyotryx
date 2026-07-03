import type { FieldSpec } from './types';
import { FeatureSpec, asResult, dobField, tobField, pobField } from './spec';
import { WESTERN_REQUESTS, CHINESE_REQUESTS, HELLENISTIC_REQUESTS, HORARY_REQUESTS, MEDICAL_REQUESTS } from './requests.p3';
import { WesternNatalResult, TransitsResult, SynastryResult } from './results/western';
import { BaZiResult, ChineseZodiacResult, FlyingStarsResult } from './results/chinese';
import { ProfectionsResult, ZodiacalReleasingResult } from './results/hellenistic';
import { KundliResult } from './results/birthChart';
import { HoraryResult } from './results/horary';
import { DecumbitureResult, BodyZodiacResult } from './results/medical';
import { HoraryHistoryScreen } from './HoraryHistory';
import { saveHoraryRecord } from './horary-history';
import type { HoraryData } from './results/responses.p3';

const CUR_YEAR = String(new Date().getFullYear());
const TODAY = new Date().toISOString().slice(0, 10);
const NOW = new Date().toISOString().slice(11, 16);

const yearField = (opts: Partial<FieldSpec> = {}): FieldSpec => ({
  key: 'year',
  label: 'Year',
  type: 'number',
  required: true,
  placeholder: 'e.g. 1994',
  ...opts,
});

export const WESTERN_FEATURES: Record<string, FeatureSpec> = {
  natal: {
    slug: 'natal',
    title: 'Western Natal',
    subtitle: 'Tropical birth chart',
    gate: 'credit',
    featureKey: 'western-natal',
    submitLabel: 'Generate',
    fields: [dobField, tobField, pobField],
    build: WESTERN_REQUESTS.natal!,
    Result: asResult(WesternNatalResult),
  },
  transits: {
    slug: 'transits',
    title: 'Transits',
    subtitle: "Today's sky vs your natal",
    gate: 'credit',
    featureKey: 'western-transits',
    autoRun: true,
    requiresBirthProfile: true,
    fields: [],
    build: WESTERN_REQUESTS.transits!,
    Result: asResult(TransitsResult),
  },
  synastry: {
    slug: 'synastry',
    title: 'Synastry',
    subtitle: 'Relationship chart comparison',
    gate: 'credit',
    featureKey: 'western-synastry',
    submitLabel: 'Compare',
    fields: [
      { key: 'a_dob', label: 'Partner A · date of birth', type: 'date', required: true, prefillFromProfile: 'dateOfBirth' },
      { key: 'a_tob', label: 'Partner A · time of birth', type: 'time', required: true, prefillFromProfile: 'timeOfBirth' },
      { key: 'b_dob', label: 'Partner B · date of birth', type: 'date', required: true },
      { key: 'b_tob', label: 'Partner B · time of birth', type: 'time', required: true },
    ],
    build: WESTERN_REQUESTS.synastry!,
    Result: asResult(SynastryResult),
  },
};

export const CHINESE_FEATURES: Record<string, FeatureSpec> = {
  bazi: {
    slug: 'bazi',
    title: 'BaZi',
    subtitle: 'Four Pillars of Destiny',
    gate: 'credit',
    featureKey: 'bazi',
    submitLabel: 'Cast pillars',
    fields: [dobField, tobField, pobField],
    build: CHINESE_REQUESTS.bazi!,
    Result: asResult(BaZiResult),
  },
  zodiac: {
    slug: 'zodiac',
    title: 'Chinese Zodiac',
    subtitle: 'Your animal & element',
    gate: 'free',
    featureKey: 'chinese-zodiac',
    submitLabel: 'Reveal',
    fields: [yearField({ label: 'Birth year' })],
    build: CHINESE_REQUESTS.zodiac!,
    Result: asResult(ChineseZodiacResult),
  },
  'flying-stars': {
    slug: 'flying-stars',
    title: 'Flying Stars',
    subtitle: 'Feng Shui annual chart',
    gate: 'free',
    featureKey: 'flying-stars',
    autoRun: true,
    submitLabel: 'View year',
    fields: [yearField({ label: 'Year', default: CUR_YEAR })],
    build: CHINESE_REQUESTS['flying-stars']!,
    Result: asResult(FlyingStarsResult),
  },
};

export const HELLENISTIC_FEATURES: Record<string, FeatureSpec> = {
  natal: {
    slug: 'natal',
    title: 'Hellenistic Natal',
    subtitle: 'Whole-sign birth chart',
    gate: 'credit',
    featureKey: 'hellenistic-natal',
    submitLabel: 'Generate',
    fields: [dobField, tobField, pobField],
    build: HELLENISTIC_REQUESTS.natal!,
    Result: asResult(KundliResult),
  },
  profections: {
    slug: 'profections',
    title: 'Profections',
    subtitle: 'Annual time-lord',
    gate: 'credit',
    featureKey: 'profections',
    submitLabel: 'Calculate',
    fields: [{ key: 'dob', label: 'Date of birth', type: 'date', required: true, prefillFromProfile: 'dateOfBirth' }],
    build: HELLENISTIC_REQUESTS.profections!,
    Result: asResult(ProfectionsResult),
  },
  'zodiacal-releasing': {
    slug: 'zodiacal-releasing',
    title: 'Zodiacal Releasing',
    subtitle: 'Peak life periods',
    gate: 'credit',
    featureKey: 'zodiacal-releasing',
    autoRun: true,
    requiresBirthProfile: true,
    fields: [],
    build: HELLENISTIC_REQUESTS['zodiacal-releasing']!,
    Result: asResult(ZodiacalReleasingResult),
  },
};

export const HORARY_FEATURES: Record<string, FeatureSpec> = {
  ask: {
    slug: 'ask',
    title: 'Ask a question',
    subtitle: 'Horary judgment for a moment',
    gate: 'credit',
    featureKey: 'horary',
    submitLabel: 'Cast the chart',
    fields: [{ key: 'question', label: 'Your question', type: 'text', required: true, placeholder: 'Will I get the job?' }],
    build: HORARY_REQUESTS.ask!,
    Result: asResult(HoraryResult),
    // Persist the reading to on-device history (mirrors web saveHoraryRecord).
    onSuccess: (data, user) => {
      const d = data as HoraryData;
      if (d?.question && d?.chart) {
        saveHoraryRecord(user?.id ?? null, { question: d.question, askedAt: d.askedAt, chart: d.chart, judgment: d.judgment });
      }
    },
  },
  history: {
    slug: 'history',
    title: 'History',
    gate: 'free',
    featureKey: 'horary-history',
    fields: [],
    build: HORARY_REQUESTS.history!,
    Result: asResult(() => null),
    custom: HoraryHistoryScreen,
  },
};

export const MEDICAL_FEATURES: Record<string, FeatureSpec> = {
  decumbiture: {
    slug: 'decumbiture',
    title: 'Decumbiture',
    subtitle: 'Chart for the onset of illness',
    gate: 'credit',
    featureKey: 'decumbiture',
    submitLabel: 'Cast chart',
    fields: [
      { key: 'date', label: 'Onset date', type: 'date', required: true, default: TODAY },
      { key: 'time', label: 'Onset time', type: 'time', required: true, default: NOW },
      { key: 'symptoms', label: 'Symptoms', type: 'text', optional: true, placeholder: 'What are you experiencing?' },
    ],
    build: MEDICAL_REQUESTS.decumbiture!,
    Result: asResult(DecumbitureResult),
  },
  'body-zodiac': {
    slug: 'body-zodiac',
    title: 'Body & Zodiac',
    subtitle: 'Melothesia — signs & body parts',
    gate: 'free',
    featureKey: 'body-zodiac',
    autoRun: true,
    fields: [],
    build: MEDICAL_REQUESTS['body-zodiac']!,
    Result: asResult(BodyZodiacResult),
  },
};
