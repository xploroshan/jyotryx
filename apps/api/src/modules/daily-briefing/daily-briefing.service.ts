import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { MemoryCacheService } from '../../common/cache.service';

export interface PlanetaryHour {
  planet: string;
  startTime: string;
  endTime: string;
  activities: string[];
  avoid: string[];
  isCurrent: boolean;
}

export interface DailyBriefingResult {
  greeting: string;
  date: string;
  dayQuality: 'excellent' | 'good' | 'moderate' | 'challenging';
  summary: string;
  doList: string[];
  avoidList: string[];
  planetaryHours: PlanetaryHour[];
  currentHora: PlanetaryHour | null;
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
  professionInsight: string;
  remedy: string;
  mantra: string;
  panchang: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    vara: string;
    rahukaal: string;
  };
  transitAlert: string | null;
}

// Planetary hour order starting from Sunday
const HORA_ORDER = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];
const DAY_RULERS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

const PLANET_ACTIVITIES: Record<string, { do: string[]; avoid: string[] }> = {
  Sun: {
    do: ['Meet authority figures', 'Leadership decisions', 'Government work', 'Health routines', 'Presentations'],
    avoid: ['Starting partnerships', 'Lending money', 'Risky investments'],
  },
  Moon: {
    do: ['Creative work', 'Client meetings', 'Nurturing relationships', 'Public-facing tasks', 'Short travel'],
    avoid: ['Major financial decisions', 'Confrontations', 'Surgery'],
  },
  Mars: {
    do: ['Physical activities', 'Debugging/problem-solving', 'Competitive tasks', 'Negotiations', 'Property matters'],
    avoid: ['Starting new partnerships', 'Signing agreements', 'Calm discussions needed'],
  },
  Mercury: {
    do: ['Communication', 'Writing', 'Coding', 'Trading', 'Learning', 'Emails', 'Data analysis'],
    avoid: ['Long-term commitments', 'Emotional decisions', 'Property purchases'],
  },
  Jupiter: {
    do: ['Teaching', 'Mentoring', 'Financial planning', 'Spiritual practices', 'Closing deals', 'Investments'],
    avoid: ['Risky speculation', 'Shortcuts', 'Unethical actions'],
  },
  Venus: {
    do: ['Client relationships', 'Creative campaigns', 'Buying/selling', 'Social media', 'Design work', 'Networking'],
    avoid: ['Aggressive negotiations', 'Conflict resolution', 'Heavy physical work'],
  },
  Saturn: {
    do: ['Long-term planning', 'Discipline tasks', 'Refactoring code', 'Compliance work', 'Auditing', 'Research'],
    avoid: ['New beginnings', 'Celebrations', 'Impulsive decisions', 'Product launches'],
  },
};

const PROFESSION_INSIGHTS: Record<string, Record<string, string>> = {
  SOFTWARE: {
    Sun: 'Strong day for architecture decisions and code reviews. Your technical leadership shines — present that proposal.',
    Moon: 'Creativity peaks today — ideal for UI/UX work, brainstorming features, and pair programming.',
    Mars: 'High energy for debugging tough issues and performance optimization. Tackle that backlog.',
    Mercury: 'Peak day for coding, documentation, and technical writing. Ship that PR. API integrations flow smoothly.',
    Jupiter: 'Great for system design, learning new tech, and mentoring juniors. Think big-picture architecture.',
    Venus: 'Focus on developer experience, clean code, and collaboration. Good for team standups and demos.',
    Saturn: 'Ideal for refactoring, writing tests, fixing tech debt, and infrastructure work. Patience pays off.',
  },
  SALES: {
    Sun: 'Power day for pitching to CXOs and decision-makers. Your confidence is magnetic. Go for the close.',
    Moon: 'Build rapport today — follow-up calls, client nurturing, and relationship building yield results.',
    Mars: 'Competitive edge is sharp. Cold calls, objection handling, and negotiation favored. Push for targets.',
    Mercury: 'Perfect for proposals, presentations, and email outreach. Data-driven pitches win today.',
    Jupiter: 'Ideal for closing big deals and expanding accounts. Upsell opportunities arise naturally.',
    Venus: 'Charm and persuasion peak. Client entertainment, networking events, and referral requests favored.',
    Saturn: 'Focus on pipeline management, CRM updates, and strategic planning. Build foundations for Q targets.',
  },
  MARKETING: {
    Sun: 'Brand visibility peaks. Launch campaigns, press releases, or thought leadership content today.',
    Moon: 'Emotional storytelling resonates. Social media engagement, content creation, and community building favored.',
    Mars: 'Aggressive growth tactics work — paid ads, competitive positioning, launch pushes.',
    Mercury: 'Data analysis, A/B testing, copywriting, and SEO optimization flow effortlessly today.',
    Jupiter: 'Think big — brand partnerships, influencer outreach, and campaign strategy sessions.',
    Venus: 'Visual content, brand aesthetics, and creative campaigns shine. Design and photo shoots favored.',
    Saturn: 'Marketing analytics, budget reviews, and long-term strategy. Optimize existing funnels.',
  },
  FINANCE: {
    Sun: 'Government and PSU stocks favored. Leadership in financial decisions. Portfolio review day.',
    Moon: 'Market sentiment sensitive — trust your instincts but set stop-losses. FMCG/healthcare sectors active.',
    Mars: 'Volatile energy — pharma/defense sectors active. Short-term trades possible but manage risk tightly.',
    Mercury: 'IT/tech stocks favored. Day trading conditions good. Data-driven analysis yields profit.',
    Jupiter: 'Banking/finance sectors strong. Long-term investments and mutual fund SIPs favored. Wealth grows.',
    Venus: 'Luxury/entertainment/FMCG stocks favorable. Gold purchases auspicious. Portfolio diversification day.',
    Saturn: 'Infrastructure/real estate sectors. Avoid speculation. Stick to blue-chips and value investing.',
  },
  STUDENT: {
    Sun: 'Focus on subjects requiring confidence — presentations, vivas, competitive exams. Leadership roles.',
    Moon: 'Creative subjects shine — arts, literature, languages. Group study effective today.',
    Mars: 'Math, science, and problem-solving peak. Physical exercise boosts mental clarity.',
    Mercury: 'Best day for intense study — reading, note-taking, exam prep. Memory retention is high.',
    Jupiter: 'Philosophy, law, and higher learning. Seek guidance from mentors. Career planning favored.',
    Venus: 'Creative arts, music, design studies excel. Social connections help academically.',
    Saturn: 'Revision and practice papers. Discipline in study schedule pays off. Focus on weak subjects.',
  },
  BUSINESS: {
    Sun: 'Government dealings, licenses, and official work favored. Lead from the front.',
    Moon: 'Customer relationships and team morale. Marketing and public-facing business activities.',
    Mars: 'Expansion moves, competitive strategies, and resource acquisition. Bold decisions pay off.',
    Mercury: 'Contracts, negotiations, accounting, and business communication. Finalize deals today.',
    Jupiter: 'Business growth, bank loans, investor meetings, and strategic partnerships. Abundance flows.',
    Venus: 'Brand building, customer experience, and team celebrations. Retail and service businesses thrive.',
    Saturn: 'Compliance, legal review, and operational efficiency. Build systems that last.',
  },
  HEALTHCARE: {
    Sun: 'Administrative decisions and leadership in clinical settings. Conference presentations.',
    Moon: 'Patient care and empathy peak. Counseling and holistic healing approaches effective.',
    Mars: 'Surgical procedures and emergency medicine favored. Physical stamina is high.',
    Mercury: 'Diagnostics, research, and medical documentation. Learning new techniques.',
    Jupiter: 'Teaching, publishing research, and medical ethics. Seeking advanced certifications.',
    Venus: 'Wellness programs, patient relationships, and aesthetic medicine.',
    Saturn: 'Long-term treatment plans, chronic care management, and procedural discipline.',
  },
  CREATIVE: {
    Sun: 'Showcase your work — exhibitions, portfolio reviews, public performances.',
    Moon: 'Raw creativity flows. Writing, composing, painting — let intuition guide you.',
    Mars: 'Action-oriented creativity — filmmaking, dance, physical performance art.',
    Mercury: 'Technical craft — editing, design software, writing drafts, musical arrangements.',
    Jupiter: 'Vision and inspiration. Start ambitious projects. Seek creative mentors.',
    Venus: 'Peak creative day. Beauty, aesthetics, and artistic expression at their finest.',
    Saturn: 'Craft discipline — practice, revision, and perfecting technique.',
  },
  GOVERNMENT: {
    Sun: 'Official decisions, policy matters, and public appearances favored.',
    Moon: 'Public engagement, welfare programs, and community outreach.',
    Mars: 'Enforcement, compliance, and administrative restructuring.',
    Mercury: 'Documentation, communication, and inter-departmental coordination.',
    Jupiter: 'Policy planning, judicial matters, and governance improvements.',
    Venus: 'Cultural events, public relations, and diplomatic engagements.',
    Saturn: 'Audits, reviews, and systemic improvements. Long-term project milestones.',
  },
  OTHER: {
    Sun: 'Take charge of your day. Leadership moments arise. Official work favored.',
    Moon: 'Nurture relationships and creative pursuits. Trust your emotional intelligence.',
    Mars: 'Channel energy into challenging tasks. Physical activity boosts productivity.',
    Mercury: 'Communication, analysis, and learning peak. Best day for emails and planning.',
    Jupiter: 'Growth and expansion. Financial planning and mentorship favored.',
    Venus: 'Social connections, aesthetics, and collaborative work thrive.',
    Saturn: 'Discipline and long-term planning. Focus on building lasting foundations.',
  },
};

@Injectable()
export class DailyBriefingService {
  private readonly logger = new Logger(DailyBriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
    private readonly cacheService: MemoryCacheService,
  ) {}

  async getDailyBriefing(userId: string): Promise<DailyBriefingResult> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const cacheKey = `briefing:${userId}:${dateStr}`;

    const cached = this.cacheService.get<DailyBriefingResult>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, dateOfBirth: true, timeOfBirth: true, placeOfBirth: true, gender: true, profession: true },
    });

    const profession = user?.profession || 'OTHER';
    const userName = user?.name?.split(' ')[0] || 'there';
    const dayOfWeek = today.getDay();
    const dayRuler = DAY_RULERS[dayOfWeek];

    // Calculate planetary hours
    const planetaryHours = this.calculatePlanetaryHours(dayOfWeek, today);
    const currentHora = planetaryHours.find((h) => h.isCurrent) || null;
    const currentPlanet = currentHora?.planet || dayRuler;

    // Panchang basics
    const panchang = this.getBasicPanchang(today);

    // Profession-specific insight
    const professionInsight = PROFESSION_INSIGHTS[profession]?.[currentPlanet]
      || PROFESSION_INSIGHTS.OTHER[currentPlanet]
      || 'Focus on your core strengths today.';

    // Build do/avoid lists based on day ruler + current hora
    const dayActivities = PLANET_ACTIVITIES[dayRuler] || PLANET_ACTIVITIES.Sun;
    const horaActivities = PLANET_ACTIVITIES[currentPlanet] || PLANET_ACTIVITIES.Sun;

    const doList = [...new Set([...dayActivities.do.slice(0, 3), ...horaActivities.do.slice(0, 2)])];
    const avoidList = [...new Set([...dayActivities.avoid, ...horaActivities.avoid.slice(0, 1)])];

    // Day quality based on planetary combinations
    const dayQuality = this.assessDayQuality(dayRuler, panchang, today);

    // Greeting
    const hour = today.getHours();
    const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const greeting = `${timeGreeting}, ${userName}!`;

    // Lucky attributes
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const colors = ['Red', 'White', 'Orange', 'Green', 'Yellow', 'Pink', 'Blue', 'Purple', 'Gold'];
    const luckyColor = this.getPlanetColor(dayRuler);
    const luckyNumber = ((dayOfYear + dayOfWeek) % 9) + 1;
    const luckyTime = currentHora ? `${currentHora.startTime} - ${currentHora.endTime}` : '10:00 AM - 11:30 AM';

    // Mantra for the day
    const mantras: Record<string, string> = {
      Sun: 'Om Suryaya Namaha',
      Moon: 'Om Chandraya Namaha',
      Mars: 'Om Mangalaya Namaha',
      Mercury: 'Om Budhaya Namaha',
      Jupiter: 'Om Gurave Namaha',
      Venus: 'Om Shukraya Namaha',
      Saturn: 'Om Shanaischaraya Namaha',
    };

    // Remedy
    const remedies: Record<string, string> = {
      Sun: 'Offer water to the rising Sun while chanting Gayatri Mantra. Wear ruby or red clothes.',
      Moon: 'Drink water from a silver glass. Wear white or pearl. Practice Chandra Namaskar.',
      Mars: 'Recite Hanuman Chalisa. Donate red lentils. Wear coral or red thread.',
      Mercury: 'Chant Vishnu Sahasranama. Wear emerald green. Feed green vegetables to cows.',
      Jupiter: 'Visit a temple and offer yellow flowers. Wear yellow sapphire. Read scriptures.',
      Venus: 'Offer white sweets to a young girl. Wear diamond or white clothes. Practice gratitude.',
      Saturn: 'Light a sesame oil lamp. Donate black items. Serve the elderly. Wear blue sapphire.',
    };

    // Summary
    const qualityDescriptions = {
      excellent: 'Stars align beautifully today — seize opportunities with confidence.',
      good: 'A favorable day with positive energy supporting your endeavors.',
      moderate: 'A balanced day — focus on steady progress rather than bold moves.',
      challenging: 'Navigate carefully today — patience and remedies will help you through.',
    };

    // Try AI-enhanced summary, fall back to KB
    let summary = '';
    let transitAlert: string | null = null;

    try {
      const kbResults = await this.knowledgeService.search(`${dayRuler} ${panchang.nakshatra} ${profession}`, undefined, 3);
      const kbContext = this.knowledgeService.assembleContext(kbResults);

      if (kbContext) {
        summary = `${qualityDescriptions[dayQuality]} Today is ${panchang.vara} ruled by ${dayRuler}. ${panchang.nakshatra} Nakshatra brings ${this.getNakshatraQuality(panchang.nakshatra)} energy. ${professionInsight}`;
      }
    } catch {
      // Ignore KB errors
    }

    if (!summary) {
      summary = `${qualityDescriptions[dayQuality]} Today is ${panchang.vara} ruled by ${dayRuler}. Current planetary hour is ${currentPlanet} hora — ${professionInsight.split('.')[0]}.`;
    }

    // Transit alert for birth-chart users
    if (user?.dateOfBirth) {
      transitAlert = this.getTransitAlert(user.dateOfBirth, today, profession);
    }

    const result: DailyBriefingResult = {
      greeting,
      date: dateStr,
      dayQuality,
      summary,
      doList,
      avoidList,
      planetaryHours,
      currentHora,
      luckyColor,
      luckyNumber,
      luckyTime,
      professionInsight,
      remedy: remedies[dayRuler] || remedies.Sun,
      mantra: mantras[dayRuler] || mantras.Sun,
      panchang,
      transitAlert,
    };

    this.cacheService.set(cacheKey, result, 30 * 60 * 1000); // 30 min cache (hora changes)
    return result;
  }

  async getPlanetaryHoursOnly(): Promise<PlanetaryHour[]> {
    const today = new Date();
    return this.calculatePlanetaryHours(today.getDay(), today);
  }

  private calculatePlanetaryHours(dayOfWeek: number, now: Date): PlanetaryHour[] {
    // Approximate sunrise 6:00 AM, sunset 6:00 PM (India)
    const sunriseMinutes = 6 * 60;
    const sunsetMinutes = 18 * 60;
    const dayDuration = sunsetMinutes - sunriseMinutes;
    const nightDuration = 24 * 60 - dayDuration;
    const dayHourLength = dayDuration / 12;
    const nightHourLength = nightDuration / 12;

    // Day hora sequence starts with the day ruler
    const startIdx = HORA_ORDER.indexOf(DAY_RULERS[dayOfWeek]);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const hours: PlanetaryHour[] = [];

    for (let i = 0; i < 24; i++) {
      const planetIdx = (startIdx + i) % 7;
      const planet = HORA_ORDER[planetIdx];
      const isDay = i < 12;
      const hourLength = isDay ? dayHourLength : nightHourLength;
      const baseMinutes = isDay ? sunriseMinutes : sunsetMinutes;
      const hourInPeriod = isDay ? i : i - 12;

      const startMin = Math.round(baseMinutes + hourInPeriod * hourLength);
      const endMin = Math.round(baseMinutes + (hourInPeriod + 1) * hourLength);

      const isCurrent = nowMinutes >= startMin && nowMinutes < endMin;

      const activities = PLANET_ACTIVITIES[planet]?.do || [];
      const avoid = PLANET_ACTIVITIES[planet]?.avoid || [];

      hours.push({
        planet,
        startTime: this.minutesToTime(startMin),
        endTime: this.minutesToTime(endMin),
        activities: activities.slice(0, 3),
        avoid: avoid.slice(0, 2),
        isCurrent,
      });
    }

    return hours;
  }

  private minutesToTime(minutes: number): string {
    const normalizedMin = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(normalizedMin / 60);
    const m = normalizedMin % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  private getBasicPanchang(today: Date) {
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const dayNames = ['Ravivaar (Sunday)', 'Somvaar (Monday)', 'Mangalvaar (Tuesday)', 'Budhvaar (Wednesday)', 'Guruvaar (Thursday)', 'Shukravaar (Friday)', 'Shanivaar (Saturday)'];
    const tithis = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
    const nakshatras = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
    const yogas = ['Vishkambha', 'Preeti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shoola', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
    const rahuKaals = ['4:30 PM - 6:00 PM', '7:30 AM - 9:00 AM', '3:00 PM - 4:30 PM', '12:00 PM - 1:30 PM', '1:30 PM - 3:00 PM', '10:30 AM - 12:00 PM', '9:00 AM - 10:30 AM'];

    const tithiIdx = dayOfYear % 30;
    const paksha = tithiIdx < 15 ? 'Shukla' : 'Krishna';

    return {
      tithi: `${paksha} ${tithis[tithiIdx % 15]}`,
      nakshatra: nakshatras[Math.floor(dayOfYear * 0.98) % 27],
      yoga: yogas[dayOfYear % 27],
      vara: dayNames[today.getDay()],
      rahukaal: rahuKaals[today.getDay()],
    };
  }

  private assessDayQuality(dayRuler: string, panchang: any, today: Date): 'excellent' | 'good' | 'moderate' | 'challenging' {
    let score = 3; // baseline

    // Benefic day rulers boost score
    if (['Jupiter', 'Venus', 'Mercury'].includes(dayRuler)) score++;
    if (['Saturn', 'Mars'].includes(dayRuler)) score--;

    // Auspicious tithis
    const auspiciousTithis = ['Panchami', 'Dashami', 'Purnima', 'Dwitiya', 'Saptami'];
    if (auspiciousTithis.some((t) => panchang.tithi.includes(t))) score++;

    // Auspicious nakshatras
    const auspiciousNak = ['Rohini', 'Pushya', 'Ashwini', 'Hasta', 'Shravana', 'Revati'];
    if (auspiciousNak.includes(panchang.nakshatra)) score++;

    // Challenging nakshatras
    const challengingNak = ['Ardra', 'Ashlesha', 'Moola', 'Jyeshtha'];
    if (challengingNak.includes(panchang.nakshatra)) score--;

    if (score >= 5) return 'excellent';
    if (score >= 4) return 'good';
    if (score >= 3) return 'moderate';
    return 'challenging';
  }

  private getNakshatraQuality(nakshatra: string): string {
    const qualities: Record<string, string> = {
      Ashwini: 'swift and healing',
      Bharani: 'transformative',
      Krittika: 'purifying and sharp',
      Rohini: 'creative and nurturing',
      Mrigashira: 'curious and seeking',
      Ardra: 'intense and cleansing',
      Punarvasu: 'renewing and optimistic',
      Pushya: 'nourishing and auspicious',
      Ashlesha: 'mystical and introspective',
      Magha: 'regal and ancestral',
      'Purva Phalguni': 'pleasurable and creative',
      'Uttara Phalguni': 'generous and supportive',
      Hasta: 'skillful and productive',
      Chitra: 'artistic and brilliant',
      Swati: 'independent and adaptable',
      Vishakha: 'determined and goal-oriented',
      Anuradha: 'devotional and friendly',
      Jyeshtha: 'protective and senior',
      Moola: 'foundational and transformative',
      'Purva Ashadha': 'invincible and confident',
      'Uttara Ashadha': 'victorious and universal',
      Shravana: 'learning and listening',
      Dhanishta: 'prosperous and rhythmic',
      Shatabhisha: 'healing and mysterious',
      'Purva Bhadrapada': 'fierce and passionate',
      'Uttara Bhadrapada': 'wise and deep',
      Revati: 'prosperous and completing',
    };
    return qualities[nakshatra] || 'balanced';
  }

  private getPlanetColor(planet: string): string {
    const colors: Record<string, string> = {
      Sun: 'Ruby Red',
      Moon: 'Pearl White',
      Mars: 'Coral Red',
      Mercury: 'Emerald Green',
      Jupiter: 'Golden Yellow',
      Venus: 'Diamond White',
      Saturn: 'Sapphire Blue',
    };
    return colors[planet] || 'White';
  }

  private getTransitAlert(dateOfBirth: Date, today: Date, profession: string): string | null {
    const dob = new Date(dateOfBirth);
    const age = today.getFullYear() - dob.getFullYear();
    const month = today.getMonth();

    // Saturn return (~29.5 years)
    if (age >= 28 && age <= 30) {
      return 'Saturn Return period active — major career and life restructuring. Embrace discipline and long-term thinking.';
    }

    // Jupiter return (~12 years)
    if (age % 12 === 0 || age % 12 === 1) {
      return 'Jupiter Return cycle — expansion, growth, and new opportunities. Say yes to big possibilities.';
    }

    // Rahu-Ketu transit (~18 months cycle)
    const monthCycle = (month + age) % 18;
    if (monthCycle === 0) {
      return 'Rahu-Ketu axis shifting in your chart — expect unconventional opportunities and karmic turns this month.';
    }

    return null;
  }
}
