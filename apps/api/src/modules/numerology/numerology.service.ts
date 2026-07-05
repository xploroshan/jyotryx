import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { KbService, KbNumberMeaningPayload, KbBusinessSectorPayload, KbPersonalYearThemePayload } from '../../knowledge/kb.service';
import { PrismaService } from '../../prisma/prisma.service';
import { buildMulankReading, MulankReading } from './mulank';

export type MulankResult =
  | ({ hasBirthDetails: true } & MulankReading)
  | { hasBirthDetails: false };

export interface NameAnalysisResult {
  name: string;
  destinyNumber: number;
  soulNumber: number;
  personalityNumber: number;
  destinyMeaning: string;
  soulMeaning: string;
  personalityMeaning: string;
  overallVerdict: 'highly_favorable' | 'favorable' | 'neutral' | 'unfavorable';
  strengths: string[];
  cautions: string[];
  bestDaysToUse: string[];
  luckyColors: string[];
  rulingPlanet: string;
  compatibility: string;
  suggestion: string;
}

export interface BrandAnalysisResult {
  brandName: string;
  nameNumber: number;
  vibration: string;
  planetaryRuler: string;
  suitableFor: string[];
  avoidFor: string[];
  overallScore: number;
  recommendation: string;
  alternativeNumbers: number[];
  bestLaunchDays: string[];
  luckyColors: string[];
}

export interface PersonalYearResult {
  personalYear: number;
  theme: string;
  description: string;
  career: string;
  finance: string;
  relationships: string;
  health: string;
  months: { month: string; focus: string }[];
}

const CHALDEAN_VALUES: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 8, g: 3, h: 5, i: 1,
  j: 1, k: 2, l: 3, m: 4, n: 5, o: 7, p: 8, q: 1, r: 2,
  s: 3, t: 4, u: 6, v: 6, w: 6, x: 5, y: 1, z: 7,
};

const PYTHAGOREAN_VALUES: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9,
  j: 1, k: 2, l: 3, m: 4, n: 5, o: 6, p: 7, q: 8, r: 9,
  s: 1, t: 2, u: 3, v: 4, w: 5, x: 6, y: 7, z: 8,
};

const VOWELS = new Set('aeiou');

// ─── English fallbacks ───────────────────────────────────────────────────────
// Authoritative data lives in KbNumberMeaning / KbBusinessSector /
// KbPersonalYearTheme / KbBriefingPhrase. These inline maps are consulted
// only when the KB cache is cold (migration not applied / DB unavailable).

const DEFAULT_NUMBER_MEANINGS: Record<number, KbNumberMeaningPayload> = {
  1:  { planet: 'Sun',     meaning: 'Leadership, independence, originality, and pioneering spirit. The number of creators and innovators.', strengths: ['Natural leader', 'Independent thinker', 'Creative force', 'Strong willpower'], cautions: ['Avoid arrogance', 'Balance independence with collaboration', 'Watch for stubbornness'], colors: ['Gold', 'Orange', 'Ruby Red'], days: ['Sunday'] },
  2:  { planet: 'Moon',    meaning: 'Diplomacy, partnership, sensitivity, and cooperation. The number of peacemakers and mediators.',        strengths: ['Excellent diplomat', 'Strong intuition', 'Team player', 'Emotionally intelligent'], cautions: ['Avoid indecisiveness', 'Set boundaries', "Don't suppress emotions"], colors: ['White', 'Silver', 'Light Green'], days: ['Monday'] },
  3:  { planet: 'Jupiter', meaning: 'Expression, creativity, joy, and expansion. The number of communicators and artists.',                   strengths: ['Creative expression', 'Optimistic nature', 'Social magnetism', 'Excellent communicator'], cautions: ['Avoid scattered energy', 'Follow through on projects', 'Watch for overindulgence'], colors: ['Yellow', 'Gold', 'Purple'], days: ['Thursday'] },
  4:  { planet: 'Rahu',    meaning: 'Stability, hard work, structure, and foundation. The number of builders and organizers.',                strengths: ['Disciplined worker', 'Practical thinker', 'Reliable partner', 'Detail-oriented'], cautions: ['Avoid rigidity', 'Embrace change', "Don't overwork", 'Unexpected events possible'], colors: ['Blue', 'Grey', 'Khaki'], days: ['Saturday', 'Sunday'] },
  5:  { planet: 'Mercury', meaning: 'Freedom, versatility, adventure, and change. The number of travelers and communicators.',                strengths: ['Adaptable mind', 'Quick thinker', 'Versatile skills', 'Excellent in business'], cautions: ['Avoid restlessness', 'Commit to decisions', "Don't spread too thin"], colors: ['Green', 'Turquoise', 'Light Grey'], days: ['Wednesday'] },
  6:  { planet: 'Venus',   meaning: 'Harmony, love, responsibility, and beauty. The number of nurturers and caretakers.',                     strengths: ['Loving nature', 'Artistic talent', 'Sense of responsibility', 'Magnetic personality'], cautions: ['Avoid self-sacrifice', 'Set healthy boundaries', "Don't neglect self-care"], colors: ['Pink', 'White', 'Light Blue'], days: ['Friday'] },
  7:  { planet: 'Ketu',    meaning: 'Spirituality, analysis, wisdom, and introspection. The number of seekers and researchers.',              strengths: ['Deep thinker', 'Spiritual awareness', 'Analytical mind', 'Research ability'], cautions: ['Avoid isolation', 'Balance analysis with action', 'Trust others more'], colors: ['Violet', 'Grey', 'Light Yellow'], days: ['Monday'] },
  8:  { planet: 'Saturn',  meaning: 'Power, abundance, karma, and material mastery. The number of executives and achievers.',                 strengths: ['Business acumen', 'Executive ability', 'Material success', 'Karmic wisdom'], cautions: ['Avoid ruthlessness', 'Balance material and spiritual', 'Watch for delays'], colors: ['Dark Blue', 'Black', 'Dark Grey'], days: ['Saturday'] },
  9:  { planet: 'Mars',    meaning: 'Completion, humanitarianism, wisdom, and universal love. The number of warriors and healers.',           strengths: ['Compassionate leader', 'Universal outlook', 'Courageous spirit', 'Inspirational presence'], cautions: ['Avoid aggression', "Don't neglect personal needs", 'Channel anger constructively'], colors: ['Red', 'Crimson', 'Scarlet'], days: ['Tuesday'] },
  11: { planet: 'Moon (Master)',    meaning: 'Master intuition, spiritual illumination, and visionary leadership. The number of enlightened teachers and healers.', strengths: ['Visionary insight', 'Spiritual teacher', 'Inspirational leader', 'Heightened intuition'], cautions: ['Avoid nervous tension', 'Ground your visions in reality', "Don't fear your own power"], colors: ['Silver', 'White', 'Pale Gold'], days: ['Monday'] },
  22: { planet: 'Rahu (Master)',    meaning: 'Master builder, turning dreams into reality, and large-scale achievement. The number of architects and visionaries.', strengths: ['Master organizer', 'Practical visionary', 'Large-scale thinker', 'Disciplined creator'], cautions: ['Avoid overwhelming yourself', 'Delegate responsibilities', 'Balance ambition with patience'], colors: ['Dark Gold', 'Coral', 'Cream'], days: ['Saturday', 'Sunday'] },
  33: { planet: 'Jupiter (Master)', meaning: 'Master teacher, selfless service, and cosmic compassion. The number of spiritual healers and uplifters.',             strengths: ['Selfless service', 'Cosmic healer', 'Inspiring mentor', 'Unconditional love'], cautions: ['Avoid martyrdom', 'Care for yourself too', 'Set healthy boundaries'], colors: ['Indigo', 'Rose', 'Deep Purple'], days: ['Thursday'] },
};

const DEFAULT_BUSINESS_SECTORS: Record<number, KbBusinessSectorPayload> = {
  1: { suitable: ['Tech startups', 'Leadership consulting', 'Innovation labs', 'Government'], avoid: ['Partnership businesses', 'Service-oriented firms'] },
  2: { suitable: ['Counseling', 'Hospitality', 'Healthcare', 'Partnerships'], avoid: ['Aggressive sales', 'Competitive industries'] },
  3: { suitable: ['Media', 'Entertainment', 'Advertising', 'Education'], avoid: ['Manufacturing', 'Heavy industry'] },
  4: { suitable: ['Construction', 'IT services', 'Manufacturing', 'Real estate'], avoid: ['Creative agencies', 'Fast-moving industries'] },
  5: { suitable: ['Trading', 'Travel', 'E-commerce', 'Stock market', 'Marketing'], avoid: ['Slow-paced industries', 'Government jobs'] },
  6: { suitable: ['Fashion', 'Beauty', 'Food', 'Luxury brands', 'Interior design'], avoid: ['Military', 'Heavy machinery'] },
  7: { suitable: ['Research', 'Technology', 'Spiritual services', 'Analytics', 'Pharma'], avoid: ['Mass retail', 'Entertainment'] },
  8: { suitable: ['Banking', 'Real estate', 'Large corporations', 'Mining', 'Law'], avoid: ['Small-scale retail', 'Creative startups'] },
  9: { suitable: ['NGOs', 'Defense', 'Sports', 'Healthcare', 'Fire-related industries'], avoid: ['Passive income businesses'] },
};

const DEFAULT_PERSONAL_YEAR_THEMES: Record<number, KbPersonalYearThemePayload> = {
  1: { theme: 'New Beginnings',              description: "A year of fresh starts, independence, and planting seeds. Take initiative on projects you've been dreaming about.", career: 'Launch new ventures, seek promotions, or pivot careers. Leadership opportunities arise.', finance: 'Start new investments. Bold financial moves are favored. Avoid debt.', relationships: 'New connections form. Existing bonds deepen through honest communication.', health: 'Start new fitness routines. Energy is high — channel it positively.' },
  2: { theme: 'Partnership & Patience',      description: 'A year of cooperation, diplomacy, and nurturing relationships. Patience brings rewards.', career: "Collaborate, don't compete. Partnerships and team projects succeed.", finance: 'Steady growth through partnerships. Avoid risky solo investments.', relationships: 'Deep bonding year. Marriage or commitment decisions favored.', health: 'Focus on emotional wellness. Meditation and yoga balance your energy.' },
  3: { theme: 'Expression & Creativity',     description: 'A year of self-expression, joy, and social expansion. Your creativity peaks.', career: 'Creative projects shine. Public speaking, writing, and media opportunities.', finance: 'Income through creative channels. Marketing investments pay off.', relationships: 'Social life blooms. New friendships and romance possibilities.', health: 'Good vitality. Watch for overindulgence in food and drink.' },
  4: { theme: 'Foundation & Hard Work',      description: 'A year of building solid foundations through discipline and persistence.', career: 'Steady work pays off. Focus on systems, processes, and skill-building.', finance: 'Save and invest conservatively. Build financial foundations.', relationships: 'Stability in relationships. Work through challenges with patience.', health: "Establish consistent health routines. Don't neglect rest." },
  5: { theme: 'Change & Freedom',            description: 'A year of major changes, travel, and breaking free from limitations.', career: 'Career shifts likely. Embrace change — it leads to growth. Travel for work.', finance: 'Variable income. Trading and quick returns possible. Diversify.', relationships: 'Dynamic energy in relationships. Avoid impulsive commitments.', health: 'Stay active. Adventure sports and travel rejuvenate you.' },
  6: { theme: 'Love & Responsibility',       description: 'A year centered on home, family, love, and taking responsibility.', career: 'Service-oriented work thrives. Real estate and home-based businesses favored.', finance: 'Home-related expenses. Investments in property or family businesses.', relationships: 'Marriage, engagement, or deepening family bonds. Love blooms.', health: 'Focus on nutrition and home cooking. Domestic harmony heals.' },
  7: { theme: 'Spiritual Growth & Analysis', description: 'A year of inner wisdom, research, and spiritual development.', career: 'Research, analysis, and specialization. Quality over quantity.', finance: 'Avoid major financial risks. Study investments carefully.', relationships: 'Introspection in relationships. Quality connections over quantity.', health: 'Mental health priority. Meditation, therapy, and nature walks.' },
  8: { theme: 'Power & Abundance',           description: 'A year of material achievement, power, and karmic rewards.', career: 'Big career moves. Promotions, business expansion, and authority.', finance: 'Financial breakthrough year. Large transactions and investments.', relationships: 'Power dynamics in relationships. Balance giving and receiving.', health: 'Strong constitution. Watch for stress-related issues.' },
  9: { theme: 'Completion & Release',        description: 'A year of endings, humanitarian service, and preparing for a new cycle.', career: 'Complete major projects. Mentor others. Philanthropy expands influence.', finance: 'Charitable giving. Release what no longer serves you financially.', relationships: 'Forgiveness and closure. Some relationships may naturally end.', health: 'Detox and renewal. Let go of unhealthy habits.' },
};

const MONTH_KEYS = [
  'month.january', 'month.february', 'month.march', 'month.april',
  'month.may', 'month.june', 'month.july', 'month.august',
  'month.september', 'month.october', 'month.november', 'month.december',
];
const DEFAULT_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DEFAULT_COMPATIBILITY_TEMPLATE = 'Best compatible with names vibrating to numbers {numbers}';
const DEFAULT_SUGGESTION_FAVORABLE = 'This name carries strong positive vibrations. Use it confidently for {planet} energy.';
const DEFAULT_SUGGESTION_NEUTRAL = 'This name has balanced energy. Consider strengthening it by adding or modifying a letter to align with numbers 1, 3, 5, or 9.';
const DEFAULT_SUGGESTION_UNFAVORABLE = 'This name may bring challenges due to {planet} influence. Consider consulting a numerologist for spelling adjustments.';
const DEFAULT_BRAND_REC_STRONG = '"{name}" carries strong {planet} energy — excellent for business growth and recognition.';
const DEFAULT_BRAND_REC_BALANCED = '"{name}" has balanced energy. Consider adding a letter to shift to number {alt} for stronger vibration.';
const DEFAULT_BRAND_REC_CHALLENGING = '"{name}" may face challenges. Consider modifying spelling to align with numbers {alt1} or {alt2}.';
const DEFAULT_SOUL_PREFIX = 'Inner desire';
const DEFAULT_PERSONALITY_PREFIX = 'Outward impression';
const DEFAULT_INVALID_MEANING = 'Please enter a valid name with alphabetic characters for analysis.';
const DEFAULT_INVALID_SUGGESTION = 'Enter a valid name to receive numerological analysis.';

@Injectable()
export class NumerologyService {
  private readonly logger = new Logger(NumerologyService.name);

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
    private readonly kbService: KbService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Mulank (root number) + Bhagyank (destiny number) reading derived from the
   * authenticated user's saved date of birth. Fully deterministic — see
   * `mulank.ts`. Returns `{ hasBirthDetails: false }` when the profile has no
   * DOB so the web layer can prompt the user to complete their profile.
   */
  async getMulank(userId: string): Promise<MulankResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dateOfBirth: true },
    });
    if (!user?.dateOfBirth) {
      return { hasBirthDetails: false };
    }
    const dob = user.dateOfBirth.toISOString().split('T')[0];
    return { hasBirthDetails: true, ...buildMulankReading(dob) };
  }

  async analyzeName(name: string, locale?: string): Promise<NameAnalysisResult> {
    const cleanName = name.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanName.length === 0) {
      // Non-Latin names: transliterate to closest Latin equivalent for analysis
      const transliterated = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
      if (transliterated.length > 0) {
        const result = await this.analyzeName(transliterated, locale);
        return { ...result, name };
      }
      return this.getInvalidNameResult(name, locale);
    }

    const destinyNumber = this.reduceToSingle(this.calculateChaldean(cleanName));
    const soulNumber = this.reduceToSingle(this.calculateVowels(cleanName));
    const personalityNumber = this.reduceToSingle(this.calculateConsonants(cleanName));

    const [destiny, soul, personality, compatTpl, suggestionFav, suggestionNeu, suggestionUnfav, soulPrefix, personalityPrefix] = await Promise.all([
      this.loadNumberMeaning(destinyNumber, locale),
      this.loadNumberMeaning(soulNumber, locale),
      this.loadNumberMeaning(personalityNumber, locale),
      this.loadPhrase('numerology.compatibility.template', DEFAULT_COMPATIBILITY_TEMPLATE, locale),
      this.loadPhrase('numerology.suggestion.favorable', DEFAULT_SUGGESTION_FAVORABLE, locale),
      this.loadPhrase('numerology.suggestion.neutral', DEFAULT_SUGGESTION_NEUTRAL, locale),
      this.loadPhrase('numerology.suggestion.unfavorable', DEFAULT_SUGGESTION_UNFAVORABLE, locale),
      this.loadPhrase('numerology.soulMeaning.prefix', DEFAULT_SOUL_PREFIX, locale),
      this.loadPhrase('numerology.personalityMeaning.prefix', DEFAULT_PERSONALITY_PREFIX, locale),
    ]);

    // Determine overall verdict
    const favorableNumbers = [1, 3, 5, 6, 9];
    const destinyFavorable = favorableNumbers.includes(destinyNumber);
    const soulFavorable = favorableNumbers.includes(soulNumber);
    const overallVerdict = destinyFavorable && soulFavorable
      ? 'highly_favorable'
      : destinyFavorable || soulFavorable
        ? 'favorable'
        : [4, 8].includes(destinyNumber)
          ? 'unfavorable'
          : 'neutral';

    // Compatibility
    const compatibleNumbers = this.getCompatibleNumbers(destinyNumber);

    return {
      name,
      destinyNumber,
      soulNumber,
      personalityNumber,
      destinyMeaning: destiny.meaning,
      soulMeaning: `${soulPrefix}: ${soul.meaning.split('.')[0]}.`,
      personalityMeaning: `${personalityPrefix}: ${personality.meaning.split('.')[0]}.`,
      overallVerdict,
      strengths: [...destiny.strengths.slice(0, 2), ...soul.strengths.slice(0, 1)],
      cautions: destiny.cautions,
      bestDaysToUse: destiny.days,
      luckyColors: destiny.colors,
      rulingPlanet: destiny.planet,
      compatibility: compatTpl.replace('{numbers}', compatibleNumbers.join(', ')),
      suggestion: this.renderSuggestion(overallVerdict, destiny.planet, suggestionFav, suggestionNeu, suggestionUnfav),
    };
  }

  async analyzeBrand(brandName: string, industry?: string, locale?: string): Promise<BrandAnalysisResult> {
    const cleanName = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const letters = cleanName.replace(/[0-9]/g, '');
    // Guard against names with no Latin letters (non-Latin scripts, or
    // digits-only like "247"): the Chaldean sum would be 0 and produce a
    // confident but meaningless "strong Sun energy" result.
    if (!letters) {
      throw new BadRequestException('Brand name must contain Latin letters (a–z) for numerology analysis.');
    }
    const nameNumber = this.reduceToSingle(this.calculateChaldean(letters));

    const [data, sectors, recStrong, recBalanced, recChallenging] = await Promise.all([
      this.loadNumberMeaning(nameNumber, locale),
      this.loadBusinessSector(nameNumber, locale),
      this.loadPhrase('numerology.brand.recommendation.strong', DEFAULT_BRAND_REC_STRONG, locale),
      this.loadPhrase('numerology.brand.recommendation.balanced', DEFAULT_BRAND_REC_BALANCED, locale),
      this.loadPhrase('numerology.brand.recommendation.challenging', DEFAULT_BRAND_REC_CHALLENGING, locale),
    ]);

    // Score 1-10 based on number favorability for business
    const businessFavorable: Record<number, number> = { 1: 8, 2: 6, 3: 9, 4: 5, 5: 9, 6: 8, 7: 6, 8: 7, 9: 8 };
    const overallScore = businessFavorable[nameNumber] || 5;

    const alternativeNumbers = [1, 3, 5, 6, 9].filter((n) => n !== nameNumber);

    let recommendation: string;
    if (overallScore >= 7) {
      recommendation = recStrong.replace('{name}', brandName).replace('{planet}', data.planet);
    } else if (overallScore >= 5) {
      recommendation = recBalanced.replace('{name}', brandName).replace('{alt}', String(alternativeNumbers[0]));
    } else {
      recommendation = recChallenging
        .replace('{name}', brandName)
        .replace('{alt1}', String(alternativeNumbers[0]))
        .replace('{alt2}', String(alternativeNumbers[1]));
    }

    return {
      brandName,
      nameNumber,
      vibration: data.meaning.split('.')[0],
      planetaryRuler: data.planet,
      suitableFor: sectors.suitable,
      avoidFor: sectors.avoid,
      overallScore,
      recommendation,
      alternativeNumbers,
      bestLaunchDays: data.days,
      luckyColors: data.colors,
    };
  }

  async getPersonalYear(dateOfBirth: string, locale?: string): Promise<PersonalYearResult> {
    const dob = new Date(dateOfBirth);
    // Reject an unparseable date rather than letting NaN collapse to a confident
    // "Personal Year 1" forecast.
    if (isNaN(dob.getTime())) {
      throw new BadRequestException('A valid date of birth is required.');
    }
    const currentYear = new Date().getFullYear();
    // UTC components so the same birth date yields the same Personal Year
    // regardless of server timezone (matches buildMulankReading).
    let personalYear = this.reduceToSingle(
      dob.getUTCDate() + (dob.getUTCMonth() + 1) + this.reduceToSingle(currentYear),
    );
    // Personal Year is a 1–9 cycle and the theme tables don't cover master
    // numbers, so fully reduce 11/22 — otherwise the response reports year 11/22
    // while all theme/career/finance content silently falls back to year 1.
    while (personalYear > 9) {
      personalYear = String(personalYear)
        .split('')
        .reduce((s, d) => s + Number(d), 0);
    }

    const data = await this.loadPersonalYearTheme(personalYear, locale);

    // Each month gets its own focus-theme (the theme of the month's own
    // reduced number), plus the localized month name from KbBriefingPhrase.
    const monthThemes = await Promise.all(
      MONTH_KEYS.map((_, i) => this.loadPersonalYearTheme(this.reduceToSingle(personalYear + i + 1), locale)),
    );
    const monthNames = await Promise.all(
      MONTH_KEYS.map((key, i) => this.loadPhrase(key, DEFAULT_MONTH_NAMES[i], locale)),
    );
    const months = MONTH_KEYS.map((_, i) => ({
      month: monthNames[i],
      focus: monthThemes[i].theme,
    }));

    return {
      personalYear,
      theme: data.theme,
      description: data.description,
      career: data.career,
      finance: data.finance,
      relationships: data.relationships,
      health: data.health,
      months,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private async loadNumberMeaning(num: number, locale?: string): Promise<KbNumberMeaningPayload> {
    const row = await this.kbService.getNumberMeaning(String(num));
    return this.kbService.render(row, locale)
      ?? DEFAULT_NUMBER_MEANINGS[num]
      ?? DEFAULT_NUMBER_MEANINGS[1];
  }

  private async loadBusinessSector(num: number, locale?: string): Promise<KbBusinessSectorPayload> {
    const row = await this.kbService.getBusinessSector(String(num));
    return this.kbService.render(row, locale)
      ?? DEFAULT_BUSINESS_SECTORS[num]
      ?? DEFAULT_BUSINESS_SECTORS[1];
  }

  private async loadPersonalYearTheme(num: number, locale?: string): Promise<KbPersonalYearThemePayload> {
    const row = await this.kbService.getPersonalYearTheme(String(num));
    return this.kbService.render(row, locale)
      ?? DEFAULT_PERSONAL_YEAR_THEMES[num]
      ?? DEFAULT_PERSONAL_YEAR_THEMES[1];
  }

  private async loadPhrase(key: string, fallback: string, locale?: string): Promise<string> {
    const row = await this.kbService.getBriefingPhrase(key);
    return this.kbService.render(row, locale)?.text ?? fallback;
  }

  private renderSuggestion(
    verdict: NameAnalysisResult['overallVerdict'],
    planet: string,
    favorable: string,
    neutral: string,
    unfavorable: string,
  ): string {
    if (verdict === 'highly_favorable' || verdict === 'favorable') {
      return favorable.replace('{planet}', planet);
    }
    if (verdict === 'neutral') {
      return neutral;
    }
    return unfavorable.replace('{planet}', planet);
  }

  private calculateChaldean(text: string): number {
    return text.split('').reduce((sum, ch) => sum + (CHALDEAN_VALUES[ch] || 0), 0);
  }

  private calculateVowels(text: string): number {
    return text.split('').filter((ch) => VOWELS.has(ch)).reduce((sum, ch) => sum + (PYTHAGOREAN_VALUES[ch] || 0), 0);
  }

  private calculateConsonants(text: string): number {
    return text.split('').filter((ch) => !VOWELS.has(ch) && PYTHAGOREAN_VALUES[ch]).reduce((sum, ch) => sum + (PYTHAGOREAN_VALUES[ch] || 0), 0);
  }

  private reduceToSingle(num: number, preserveMaster = true): number {
    while (num > 9) {
      if (preserveMaster && (num === 11 || num === 22 || num === 33)) break;
      num = num.toString().split('').reduce((s, d) => s + parseInt(d, 10), 0);
    }
    return num || 1;
  }

  private getCompatibleNumbers(num: number): number[] {
    const compatibility: Record<number, number[]> = {
      1: [1, 3, 5, 9],
      2: [2, 4, 6, 8],
      3: [1, 3, 5, 9],
      4: [2, 4, 6, 8],
      5: [1, 3, 5, 7, 9],
      6: [2, 4, 6, 8],
      7: [5, 7],
      8: [2, 4, 6, 8],
      9: [1, 3, 5, 9],
    };
    return compatibility[num] || [1, 5, 9];
  }

  private async getInvalidNameResult(name: string, locale?: string): Promise<NameAnalysisResult> {
    const [meaning, suggestion] = await Promise.all([
      this.loadPhrase('numerology.invalidName.meaning', DEFAULT_INVALID_MEANING, locale),
      this.loadPhrase('numerology.invalidName.suggestion', DEFAULT_INVALID_SUGGESTION, locale),
    ]);
    return {
      name,
      destinyNumber: 1,
      soulNumber: 1,
      personalityNumber: 1,
      destinyMeaning: meaning,
      soulMeaning: '',
      personalityMeaning: '',
      overallVerdict: 'neutral',
      strengths: [],
      cautions: [],
      bestDaysToUse: [],
      luckyColors: [],
      rulingPlanet: 'Sun',
      compatibility: '',
      suggestion,
    };
  }
}
