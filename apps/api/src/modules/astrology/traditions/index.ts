/**
 * Astrology Tradition Configuration Registry
 *
 * Defines metadata and AI prompt templates for each supported astrology tradition.
 * Adding a new tradition requires:
 * 1. Add enum value to AstrologyTradition in Prisma schema + shared types
 * 2. Create a config entry below
 * 3. Add tradition-specific calculation logic in astrology.service.ts
 */

export interface TraditionConfig {
  id: string;
  name: string;
  description: string;
  zodiacType: 'sidereal' | 'tropical' | 'lunar';
  signSystem: string[];
  houseSystem: string;
  systemPromptPrefix: string;
  horoscopePrompt: (sign: string, period: string, periodDesc: string) => string;
  features: string[];
  isAvailable: boolean;
}

// ─── Vedic Astrology ────────────────────────────────────────────────────────

const VEDIC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const vedicConfig: TraditionConfig = {
  id: 'VEDIC',
  name: 'Vedic / Jyotish',
  description: 'Ancient Indian astrology using sidereal zodiac, nakshatras, and dashas',
  zodiacType: 'sidereal',
  signSystem: VEDIC_SIGNS,
  houseSystem: 'Equal',
  systemPromptPrefix: 'You are an expert Vedic astrologer with deep knowledge of planetary transits, Nakshatras, and Dasha periods.',
  horoscopePrompt: (sign, period, periodDesc) =>
    `You are an expert Vedic astrologer with deep knowledge of planetary transits, Nakshatras, and Dasha periods. Generate a ${period} horoscope prediction for the given zodiac sign. Return a JSON object with:
- prediction: string (${period === 'daily' ? '3-4' : '5-7'} sentences, specific overview referencing current planetary positions and transits relevant to this sign)
- career: string (${period === 'daily' ? '2-3' : '3-5'} sentences about career and financial outlook, referencing specific planetary influences on the 2nd, 6th, 10th houses)
- health: string (${period === 'daily' ? '2-3' : '3-5'} sentences about health and wellness, referencing planetary effects on the 6th and 8th houses, suggest specific remedies or practices)
- love: string (${period === 'daily' ? '2-3' : '3-5'} sentences about love and relationships, referencing Venus, 7th house lord, and relationship dynamics)
- luckyNumber: number (1-9, based on ruling planet numerology)
- luckyColor: string (based on the sign's ruling planet)
- mood: string (one word reflecting dominant planetary energy)
- compatibility: string (most compatible sign based on current transits)

Make each section unique and specific to the sign. Avoid generic advice. Reference actual Vedic concepts like Nakshatras, Dashas, and planetary lordships.`,
  features: ['kundli', 'matching', 'horoscope', 'panchang', 'muhurat', 'dosha', 'sadeSati', 'divisional', 'kp'],
  isAvailable: true,
};

// ─── Western Astrology ──────────────────────────────────────────────────────

const WESTERN_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const westernConfig: TraditionConfig = {
  id: 'WESTERN',
  name: 'Western Astrology',
  description: 'Tropical zodiac system with aspects, transits, and house analysis',
  zodiacType: 'tropical',
  signSystem: WESTERN_SIGNS,
  houseSystem: 'Placidus',
  systemPromptPrefix: 'You are an expert Western astrologer with deep knowledge of the tropical zodiac, planetary aspects, transits, and modern psychological astrology.',
  horoscopePrompt: (sign, period, periodDesc) =>
    `You are an expert Western astrologer with deep knowledge of the tropical zodiac, planetary aspects, transits, and modern psychological astrology. Generate a ${period} horoscope prediction for the given zodiac sign. Return a JSON object with:
- prediction: string (${period === 'daily' ? '3-4' : '5-7'} sentences, specific overview referencing current planetary transits, aspects (conjunctions, squares, trines, oppositions), and their psychological/practical impacts)
- career: string (${period === 'daily' ? '2-3' : '3-5'} sentences about career and financial outlook, referencing Midheaven, 10th house influences, and Saturn/Jupiter transits)
- health: string (${period === 'daily' ? '2-3' : '3-5'} sentences about health and wellness, referencing Mars energy, 6th house, and self-care aligned with planetary influences)
- love: string (${period === 'daily' ? '2-3' : '3-5'} sentences about love and relationships, referencing Venus transits, 7th house ruler, synastry themes)
- luckyNumber: number (1-9, based on planetary numerology)
- luckyColor: string (based on the sign's planetary ruler)
- mood: string (one word reflecting dominant planetary energy)
- compatibility: string (most compatible sign based on current transits and elemental harmony)

Make each section unique and specific to the sign. Avoid generic advice. Reference Western astrology concepts like aspects (trine, square, opposition, conjunction, sextile), elements (Fire, Earth, Air, Water), modalities (Cardinal, Fixed, Mutable), and ruling planets.`,
  features: ['natalChart', 'horoscope', 'synastry', 'transits'],
  isAvailable: true,
};

// ─── Chinese Astrology ──────────────────────────────────────────────────────

const CHINESE_ANIMALS = [
  'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
  'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig',
];

const CHINESE_ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

const chineseConfig: TraditionConfig = {
  id: 'CHINESE',
  name: 'Chinese Astrology',
  description: '12 animal signs, Five Elements, and Yin-Yang cycles based on the lunar calendar',
  zodiacType: 'lunar',
  signSystem: CHINESE_ANIMALS,
  houseSystem: 'FourPillars',
  systemPromptPrefix: 'You are an expert Chinese astrologer with deep knowledge of the 12 zodiac animals, Five Elements (Wu Xing), Yin-Yang theory, and the Four Pillars of Destiny (BaZi).',
  horoscopePrompt: (sign, period, periodDesc) =>
    `You are an expert Chinese astrologer with deep knowledge of the 12 zodiac animals, Five Elements (Wu Xing), Yin-Yang theory, and the Four Pillars of Destiny (BaZi). Generate a ${period} horoscope prediction for the given Chinese zodiac animal sign. Return a JSON object with:
- prediction: string (${period === 'daily' ? '3-4' : '5-7'} sentences, specific overview referencing the animal sign's elemental interactions, Yin-Yang balance, and current year's ruling animal energy)
- career: string (${period === 'daily' ? '2-3' : '3-5'} sentences about career and financial outlook, referencing Five Element cycles, auspicious directions, and prosperity guidance)
- health: string (${period === 'daily' ? '2-3' : '3-5'} sentences about health and wellness, referencing the sign's associated organ systems in Traditional Chinese Medicine, elemental balance, and Qi flow)
- love: string (${period === 'daily' ? '2-3' : '3-5'} sentences about love and relationships, referencing animal compatibility (Triangle of Affinity, clashing signs), Yin-Yang harmony, and relationship feng shui)
- luckyNumber: number (1-9, based on Chinese numerology and the sign's element)
- luckyColor: string (based on the sign's element: Wood=green, Fire=red, Earth=yellow, Metal=white, Water=blue/black)
- mood: string (one word reflecting dominant elemental energy)
- compatibility: string (most compatible animal sign based on current year's energy)

Make each section unique and specific to the animal sign. Avoid generic advice. Reference Chinese astrology concepts like the 12-year cycle, elemental interactions (generating and overcoming cycles), Yin-Yang polarity, and feng shui principles.`,
  features: ['yearlyForecast', 'horoscope', 'compatibility', 'elementAnalysis'],
  isAvailable: true,
};

// ─── Future Traditions (Coming Soon) ────────────────────────────────────────

// Placeholder configs for UI display purposes (not yet functional)
const hellenisticConfig: TraditionConfig = {
  id: 'HELLENISTIC',
  name: 'Hellenistic Astrology',
  description: 'Ancient Greco-Roman tradition using whole sign houses and traditional techniques',
  zodiacType: 'tropical',
  signSystem: WESTERN_SIGNS,
  houseSystem: 'WholeSign',
  systemPromptPrefix: '',
  horoscopePrompt: () => '',
  features: [],
  isAvailable: false,
};

const horaryConfig: TraditionConfig = {
  id: 'HORARY',
  name: 'Horary Astrology',
  description: 'Answer specific questions based on the time a question is asked',
  zodiacType: 'tropical',
  signSystem: WESTERN_SIGNS,
  houseSystem: 'Regiomontanus',
  systemPromptPrefix: '',
  horoscopePrompt: () => '',
  features: [],
  isAvailable: false,
};

const medicalConfig: TraditionConfig = {
  id: 'MEDICAL',
  name: 'Medical Astrology',
  description: 'Health-focused astrology linking zodiac signs to body systems and wellness',
  zodiacType: 'tropical',
  signSystem: WESTERN_SIGNS,
  houseSystem: 'Placidus',
  systemPromptPrefix: '',
  horoscopePrompt: () => '',
  features: [],
  isAvailable: false,
};

// ─── Registry ───────────────────────────────────────────────────────────────

export const TRADITION_CONFIGS: Record<string, TraditionConfig> = {
  VEDIC: vedicConfig,
  WESTERN: westernConfig,
  CHINESE: chineseConfig,
  HELLENISTIC: hellenisticConfig,
  HORARY: horaryConfig,
  MEDICAL: medicalConfig,
};

export const AVAILABLE_TRADITIONS = Object.values(TRADITION_CONFIGS).filter(t => t.isAvailable);

export function getTraditionConfig(id: string): TraditionConfig | undefined {
  return TRADITION_CONFIGS[id];
}

export { CHINESE_ANIMALS, CHINESE_ELEMENTS };
