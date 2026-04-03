import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';

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

const NUMBER_MEANINGS: Record<number, { planet: string; meaning: string; strengths: string[]; cautions: string[]; colors: string[]; days: string[] }> = {
  1: {
    planet: 'Sun',
    meaning: 'Leadership, independence, originality, and pioneering spirit. The number of creators and innovators.',
    strengths: ['Natural leader', 'Independent thinker', 'Creative force', 'Strong willpower'],
    cautions: ['Avoid arrogance', 'Balance independence with collaboration', 'Watch for stubbornness'],
    colors: ['Gold', 'Orange', 'Ruby Red'],
    days: ['Sunday'],
  },
  2: {
    planet: 'Moon',
    meaning: 'Diplomacy, partnership, sensitivity, and cooperation. The number of peacemakers and mediators.',
    strengths: ['Excellent diplomat', 'Strong intuition', 'Team player', 'Emotionally intelligent'],
    cautions: ['Avoid indecisiveness', 'Set boundaries', 'Don\'t suppress emotions'],
    colors: ['White', 'Silver', 'Light Green'],
    days: ['Monday'],
  },
  3: {
    planet: 'Jupiter',
    meaning: 'Expression, creativity, joy, and expansion. The number of communicators and artists.',
    strengths: ['Creative expression', 'Optimistic nature', 'Social magnetism', 'Excellent communicator'],
    cautions: ['Avoid scattered energy', 'Follow through on projects', 'Watch for overindulgence'],
    colors: ['Yellow', 'Gold', 'Purple'],
    days: ['Thursday'],
  },
  4: {
    planet: 'Rahu',
    meaning: 'Stability, hard work, structure, and foundation. The number of builders and organizers.',
    strengths: ['Disciplined worker', 'Practical thinker', 'Reliable partner', 'Detail-oriented'],
    cautions: ['Avoid rigidity', 'Embrace change', 'Don\'t overwork', 'Unexpected events possible'],
    colors: ['Blue', 'Grey', 'Khaki'],
    days: ['Saturday', 'Sunday'],
  },
  5: {
    planet: 'Mercury',
    meaning: 'Freedom, versatility, adventure, and change. The number of travelers and communicators.',
    strengths: ['Adaptable mind', 'Quick thinker', 'Versatile skills', 'Excellent in business'],
    cautions: ['Avoid restlessness', 'Commit to decisions', 'Don\'t spread too thin'],
    colors: ['Green', 'Turquoise', 'Light Grey'],
    days: ['Wednesday'],
  },
  6: {
    planet: 'Venus',
    meaning: 'Harmony, love, responsibility, and beauty. The number of nurturers and caretakers.',
    strengths: ['Loving nature', 'Artistic talent', 'Sense of responsibility', 'Magnetic personality'],
    cautions: ['Avoid self-sacrifice', 'Set healthy boundaries', 'Don\'t neglect self-care'],
    colors: ['Pink', 'White', 'Light Blue'],
    days: ['Friday'],
  },
  7: {
    planet: 'Ketu',
    meaning: 'Spirituality, analysis, wisdom, and introspection. The number of seekers and researchers.',
    strengths: ['Deep thinker', 'Spiritual awareness', 'Analytical mind', 'Research ability'],
    cautions: ['Avoid isolation', 'Balance analysis with action', 'Trust others more'],
    colors: ['Violet', 'Grey', 'Light Yellow'],
    days: ['Monday'],
  },
  8: {
    planet: 'Saturn',
    meaning: 'Power, abundance, karma, and material mastery. The number of executives and achievers.',
    strengths: ['Business acumen', 'Executive ability', 'Material success', 'Karmic wisdom'],
    cautions: ['Avoid ruthlessness', 'Balance material and spiritual', 'Watch for delays'],
    colors: ['Dark Blue', 'Black', 'Dark Grey'],
    days: ['Saturday'],
  },
  9: {
    planet: 'Mars',
    meaning: 'Completion, humanitarianism, wisdom, and universal love. The number of warriors and healers.',
    strengths: ['Compassionate leader', 'Universal outlook', 'Courageous spirit', 'Inspirational presence'],
    cautions: ['Avoid aggression', 'Don\'t neglect personal needs', 'Channel anger constructively'],
    colors: ['Red', 'Crimson', 'Scarlet'],
    days: ['Tuesday'],
  },
};

const BUSINESS_SECTORS: Record<number, { suitable: string[]; avoid: string[] }> = {
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

@Injectable()
export class NumerologyService {
  private readonly logger = new Logger(NumerologyService.name);

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async analyzeName(name: string): Promise<NameAnalysisResult> {
    const cleanName = name.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanName.length === 0) {
      return this.getDefaultNameResult(name);
    }

    const destinyNumber = this.reduceToSingle(this.calculateChaldean(cleanName));
    const soulNumber = this.reduceToSingle(this.calculateVowels(cleanName));
    const personalityNumber = this.reduceToSingle(this.calculateConsonants(cleanName));

    const destiny = NUMBER_MEANINGS[destinyNumber] || NUMBER_MEANINGS[1];
    const soul = NUMBER_MEANINGS[soulNumber] || NUMBER_MEANINGS[1];
    const personality = NUMBER_MEANINGS[personalityNumber] || NUMBER_MEANINGS[1];

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
      soulMeaning: `Inner desire: ${soul.meaning.split('.')[0]}.`,
      personalityMeaning: `Outward impression: ${personality.meaning.split('.')[0]}.`,
      overallVerdict,
      strengths: [...destiny.strengths.slice(0, 2), ...soul.strengths.slice(0, 1)],
      cautions: destiny.cautions,
      bestDaysToUse: destiny.days,
      luckyColors: destiny.colors,
      rulingPlanet: destiny.planet,
      compatibility: `Best compatible with names vibrating to numbers ${compatibleNumbers.join(', ')}`,
      suggestion: this.getNameSuggestion(destinyNumber, overallVerdict),
    };
  }

  async analyzeBrand(brandName: string, industry?: string): Promise<BrandAnalysisResult> {
    const cleanName = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameNumber = this.reduceToSingle(this.calculateChaldean(cleanName.replace(/[0-9]/g, '')));
    const data = NUMBER_MEANINGS[nameNumber] || NUMBER_MEANINGS[1];
    const sectors = BUSINESS_SECTORS[nameNumber] || BUSINESS_SECTORS[1];

    // Score 1-10 based on number favorability for business
    const businessFavorable: Record<number, number> = { 1: 8, 2: 6, 3: 9, 4: 5, 5: 9, 6: 8, 7: 6, 8: 7, 9: 8 };
    const overallScore = businessFavorable[nameNumber] || 5;

    const alternativeNumbers = [1, 3, 5, 6, 9].filter((n) => n !== nameNumber);

    return {
      brandName,
      nameNumber,
      vibration: data.meaning.split('.')[0],
      planetaryRuler: data.planet,
      suitableFor: sectors.suitable,
      avoidFor: sectors.avoid,
      overallScore,
      recommendation: overallScore >= 7
        ? `"${brandName}" carries strong ${data.planet} energy — excellent for business growth and recognition.`
        : overallScore >= 5
          ? `"${brandName}" has balanced energy. Consider adding a letter to shift to number ${alternativeNumbers[0]} for stronger vibration.`
          : `"${brandName}" may face challenges. Consider modifying spelling to align with numbers ${alternativeNumbers.slice(0, 2).join(' or ')}.`,
      alternativeNumbers,
      bestLaunchDays: data.days,
      luckyColors: data.colors,
    };
  }

  async getPersonalYear(dateOfBirth: string): Promise<PersonalYearResult> {
    const dob = new Date(dateOfBirth);
    const currentYear = new Date().getFullYear();
    const personalYear = this.reduceToSingle(
      dob.getDate() + (dob.getMonth() + 1) + this.reduceToSingle(currentYear),
    );

    const themes: Record<number, { theme: string; desc: string; career: string; finance: string; relationships: string; health: string }> = {
      1: { theme: 'New Beginnings', desc: 'A year of fresh starts, independence, and planting seeds. Take initiative on projects you\'ve been dreaming about.', career: 'Launch new ventures, seek promotions, or pivot careers. Leadership opportunities arise.', finance: 'Start new investments. Bold financial moves are favored. Avoid debt.', relationships: 'New connections form. Existing bonds deepen through honest communication.', health: 'Start new fitness routines. Energy is high — channel it positively.' },
      2: { theme: 'Partnership & Patience', desc: 'A year of cooperation, diplomacy, and nurturing relationships. Patience brings rewards.', career: 'Collaborate, don\'t compete. Partnerships and team projects succeed.', finance: 'Steady growth through partnerships. Avoid risky solo investments.', relationships: 'Deep bonding year. Marriage or commitment decisions favored.', health: 'Focus on emotional wellness. Meditation and yoga balance your energy.' },
      3: { theme: 'Expression & Creativity', desc: 'A year of self-expression, joy, and social expansion. Your creativity peaks.', career: 'Creative projects shine. Public speaking, writing, and media opportunities.', finance: 'Income through creative channels. Marketing investments pay off.', relationships: 'Social life blooms. New friendships and romance possibilities.', health: 'Good vitality. Watch for overindulgence in food and drink.' },
      4: { theme: 'Foundation & Hard Work', desc: 'A year of building solid foundations through discipline and persistence.', career: 'Steady work pays off. Focus on systems, processes, and skill-building.', finance: 'Save and invest conservatively. Build financial foundations.', relationships: 'Stability in relationships. Work through challenges with patience.', health: 'Establish consistent health routines. Don\'t neglect rest.' },
      5: { theme: 'Change & Freedom', desc: 'A year of major changes, travel, and breaking free from limitations.', career: 'Career shifts likely. Embrace change — it leads to growth. Travel for work.', finance: 'Variable income. Trading and quick returns possible. Diversify.', relationships: 'Dynamic energy in relationships. Avoid impulsive commitments.', health: 'Stay active. Adventure sports and travel rejuvenate you.' },
      6: { theme: 'Love & Responsibility', desc: 'A year centered on home, family, love, and taking responsibility.', career: 'Service-oriented work thrives. Real estate and home-based businesses favored.', finance: 'Home-related expenses. Investments in property or family businesses.', relationships: 'Marriage, engagement, or deepening family bonds. Love blooms.', health: 'Focus on nutrition and home cooking. Domestic harmony heals.' },
      7: { theme: 'Spiritual Growth & Analysis', desc: 'A year of inner wisdom, research, and spiritual development.', career: 'Research, analysis, and specialization. Quality over quantity.', finance: 'Avoid major financial risks. Study investments carefully.', relationships: 'Introspection in relationships. Quality connections over quantity.', health: 'Mental health priority. Meditation, therapy, and nature walks.' },
      8: { theme: 'Power & Abundance', desc: 'A year of material achievement, power, and karmic rewards.', career: 'Big career moves. Promotions, business expansion, and authority.', finance: 'Financial breakthrough year. Large transactions and investments.', relationships: 'Power dynamics in relationships. Balance giving and receiving.', health: 'Strong constitution. Watch for stress-related issues.' },
      9: { theme: 'Completion & Release', desc: 'A year of endings, humanitarian service, and preparing for a new cycle.', career: 'Complete major projects. Mentor others. Philanthropy expands influence.', finance: 'Charitable giving. Release what no longer serves you financially.', relationships: 'Forgiveness and closure. Some relationships may naturally end.', health: 'Detox and renewal. Let go of unhealthy habits.' },
    };

    const data = themes[personalYear] || themes[1];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthFocuses = months.map((month, i) => {
      const monthNum = this.reduceToSingle(personalYear + i + 1);
      const focus = themes[monthNum]?.theme || 'Balanced Energy';
      return { month, focus };
    });

    return {
      personalYear,
      theme: data.theme,
      description: data.desc,
      career: data.career,
      finance: data.finance,
      relationships: data.relationships,
      health: data.health,
      months: monthFocuses,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private calculateChaldean(text: string): number {
    return text.split('').reduce((sum, ch) => sum + (CHALDEAN_VALUES[ch] || 0), 0);
  }

  private calculateVowels(text: string): number {
    return text.split('').filter((ch) => VOWELS.has(ch)).reduce((sum, ch) => sum + (PYTHAGOREAN_VALUES[ch] || 0), 0);
  }

  private calculateConsonants(text: string): number {
    return text.split('').filter((ch) => !VOWELS.has(ch) && PYTHAGOREAN_VALUES[ch]).reduce((sum, ch) => sum + (PYTHAGOREAN_VALUES[ch] || 0), 0);
  }

  private reduceToSingle(num: number): number {
    while (num > 9) {
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

  private getNameSuggestion(destinyNumber: number, verdict: string): string {
    if (verdict === 'highly_favorable' || verdict === 'favorable') {
      return `This name carries strong positive vibrations. Use it confidently for ${NUMBER_MEANINGS[destinyNumber]?.planet || 'planetary'} energy.`;
    }
    if (verdict === 'neutral') {
      return 'This name has balanced energy. Consider strengthening it by adding or modifying a letter to align with numbers 1, 3, 5, or 9.';
    }
    return `This name may bring challenges due to ${NUMBER_MEANINGS[destinyNumber]?.planet || 'planetary'} influence. Consider consulting a numerologist for spelling adjustments.`;
  }

  private getDefaultNameResult(name: string): NameAnalysisResult {
    return {
      name,
      destinyNumber: 1,
      soulNumber: 1,
      personalityNumber: 1,
      destinyMeaning: 'Please enter a valid name with alphabetic characters for analysis.',
      soulMeaning: '',
      personalityMeaning: '',
      overallVerdict: 'neutral',
      strengths: [],
      cautions: [],
      bestDaysToUse: [],
      luckyColors: [],
      rulingPlanet: 'Sun',
      compatibility: '',
      suggestion: 'Enter a valid name to receive numerological analysis.',
    };
  }
}
