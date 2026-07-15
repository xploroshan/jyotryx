import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { KbService } from '../../knowledge/kb.service';
import { MemoryCacheService } from '../../common/cache.service';
import {
  DEFAULT_TZ,
  isValidTimeZone,
  resolveTimezoneFromCoords,
  zonedNow,
  type ZonedNow,
} from '../../common/timezone.util';
import { GocharPersonalization, GocharService } from './gochar.service';

/**
 * Map a local hour-of-day to the briefing greeting KB key. Exported for tests
 * so the morning/afternoon/evening boundaries are pinned and can't drift.
 */
export function greetingKeyForHour(hour: number): 'greeting.morning' | 'greeting.afternoon' | 'greeting.evening' {
  return hour < 12 ? 'greeting.morning' : hour < 17 ? 'greeting.afternoon' : 'greeting.evening';
}

// Vara (weekday) and Rahukaal are civil-day concepts, indexed 0=Sunday … 6=Saturday.
// Hoisted to module scope so both the approximate panchang and the ephemeris
// path can pin them to the user's LOCAL weekday.
const VARA_KEYS = ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];
const RAHU_KAALS = ['4:30 PM - 6:00 PM', '7:30 AM - 9:00 AM', '3:00 PM - 4:30 PM', '12:00 PM - 1:30 PM', '1:30 PM - 3:00 PM', '10:30 AM - 12:00 PM', '9:00 AM - 10:30 AM'];

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
  /** True when the reading is derived from the user's own birth chart (Gochar).
   *  When false, the chart layer is dark and the card is the shared almanac —
   *  the client shows a "complete your birth details" prompt. */
  personalized: boolean;
  /** Why the chart layer is/ isn't active — drives the client's prompt copy. */
  personalizationReason: PersonalizationReason;
  /** Natal Moon sign, when the chart layer is active (else null). */
  moonSign: string | null;
  astrologyTraditions: string[];
}

/**
 * Why the per-user chart layer is or isn't active.
 *  - ok            → personalized from the user's chart
 *  - no_birth_data → no date of birth on file
 *  - missing_time  → has DOB but no exact birth time
 *  - missing_place → has DOB + time but the birthplace isn't geocoded (no lat/lng)
 *  - unavailable   → all data present but the ephemeris couldn't compute (or is off)
 */
export type PersonalizationReason =
  | 'ok'
  | 'no_birth_data'
  | 'missing_time'
  | 'missing_place'
  | 'unavailable';

// ─── Internal cache layer types ─────────────────────────────────────────────

interface GlobalBriefingData {
  dayRuler: string;
  currentPlanet: string;
  dayQuality: DailyBriefingResult['dayQuality'];
  doList: string[];
  avoidList: string[];
  planetaryHours: PlanetaryHour[];
  currentHora: PlanetaryHour | null;
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
  remedy: string;
  mantra: string;
  panchang: DailyBriefingResult['panchang'];
  /** Canonical keys preserved for the user-overlay summary composition. */
  canonical: PanchangCanonical;
}

interface UserBriefingOverlay {
  greeting: string;
  professionInsight: string;
  summary: string;
  transitAlert: string | null;
}

interface PanchangCanonical {
  pakshaKey: string;
  tithiKey: string;
  nakshatraKey: string;
  yogaKey: string;
  varaKey: string;
  rahukaal: string;
}

// Planetary hour order starting from Sunday
const HORA_ORDER = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];
const DAY_RULERS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

// English fallbacks — used when the KB cache is cold (DB unavailable /
// migration not applied). Steady-state reads come from `KbService`.
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

const DEFAULT_MANTRAS: Record<string, string> = {
  Sun: 'Om Suryaya Namaha', Moon: 'Om Chandraya Namaha', Mars: 'Om Mangalaya Namaha',
  Mercury: 'Om Budhaya Namaha', Jupiter: 'Om Gurave Namaha', Venus: 'Om Shukraya Namaha',
  Saturn: 'Om Shanaischaraya Namaha',
};

const DEFAULT_REMEDIES: Record<string, string> = {
  Sun: 'Offer water to the rising Sun while chanting Gayatri Mantra. Wear ruby or red clothes.',
  Moon: 'Drink water from a silver glass. Wear white or pearl. Practice Chandra Namaskar.',
  Mars: 'Recite Hanuman Chalisa. Donate red lentils. Wear coral or red thread.',
  Mercury: 'Chant Vishnu Sahasranama. Wear emerald green. Feed green vegetables to cows.',
  Jupiter: 'Visit a temple and offer yellow flowers. Wear yellow sapphire. Read scriptures.',
  Venus: 'Offer white sweets to a young girl. Wear diamond or white clothes. Practice gratitude.',
  Saturn: 'Light a sesame oil lamp. Donate black items. Serve the elderly. Wear blue sapphire.',
};

const DEFAULT_PLANET_COLORS: Record<string, string> = {
  Sun: 'Ruby Red', Moon: 'Pearl White', Mars: 'Coral Red', Mercury: 'Emerald Green',
  Jupiter: 'Golden Yellow', Venus: 'Diamond White', Saturn: 'Sapphire Blue',
};

const DEFAULT_QUALITY_DESC: Record<DailyBriefingResult['dayQuality'], string> = {
  excellent: 'Stars align beautifully today — seize opportunities with confidence.',
  good: 'A favorable day with positive energy supporting your endeavors.',
  moderate: 'A balanced day — focus on steady progress rather than bold moves.',
  challenging: 'Navigate carefully today — patience and remedies will help you through.',
};

const DEFAULT_TRANSIT_TEMPLATES: Record<string, string> = {
  'transit.saturn_return':  'Saturn Return period active — major career and life restructuring. Embrace discipline and long-term thinking.',
  'transit.jupiter_return': 'Jupiter Return cycle — expansion, growth, and new opportunities. Say yes to big possibilities.',
  'transit.rahu_ketu':      'Rahu-Ketu axis shifting in your chart — expect unconventional opportunities and karmic turns this month.',
};

const DEFAULT_SUMMARY_TEMPLATE =
  '{quality_desc} Today is {vara} ruled by {day_ruler}. {nakshatra} Nakshatra brings {nakshatra_quality} energy. {insight}';

const DEFAULT_GREETING_MAP: Record<string, string> = {
  'greeting.morning':   'Good Morning',
  'greeting.afternoon': 'Good Afternoon',
  'greeting.evening':   'Good Evening',
};

// English fallback for profession × planet insights. The authoritative data
// lives in KbProfessionInsight (10 professions × 7 planets); this map is
// consulted only when the KB cache is cold.
const DEFAULT_PROFESSION_INSIGHTS: Record<string, Record<string, string>> = {
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
    private readonly kbService: KbService,
    // Optional so the unit suite (which builds this service standalone) and any
    // environment without the ephemeris still work — personalization simply
    // stays dormant and the shared almanac is served.
    @Optional() private readonly gocharService?: GocharService,
  ) {}

  /**
   * Resolve the timezone to compute "today" in. Priority:
   *   1. an explicit IANA zone from the caller (the browser's current zone —
   *      correct even when the user is travelling / an NRI), when valid;
   *   2. the user's birthplace coordinates (works server-side, e.g. the email
   *      fanout, where there is no browser);
   *   3. {@link DEFAULT_TZ} (Asia/Kolkata) as the India-first fallback.
   */
  private async resolveUserTimezone(userId: string, timeZone?: string): Promise<string> {
    if (isValidTimeZone(timeZone)) return timeZone;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { placeOfBirth: true },
    });
    const pob = (user?.placeOfBirth as { lat?: number; lng?: number } | null) ?? null;
    return resolveTimezoneFromCoords(pob?.lat, pob?.lng);
  }

  async getDailyBriefing(userId: string, locale?: string, timeZone?: string): Promise<DailyBriefingResult> {
    const tz = await this.resolveUserTimezone(userId, timeZone);
    // `now` is the real instant — used for ephemeris/transit positions (which
    // are the same physical sky for everyone). `z` is that instant expressed in
    // the user's zone — used for the civil date, weekday and greeting.
    const now = new Date();
    const z = zonedNow(now, tz);
    const dateStr = z.dateStr;
    // 30-min bucket aligns with hora changes (computed in the user's zone)
    const hourBucket = Math.floor((z.hour * 60 + z.minute) / 30);
    const localeKey = locale || 'en';

    // ── 1. Global portion (shared across users in the same zone + locale) ──
    // The zone is part of the key because the panchang/vara are now zone-aware,
    // so two users at the same local time but different zones must not share it.
    const globalKey = `briefing:global:${dateStr}:${hourBucket}:${z.zone}:${localeKey}`;
    let global = await this.cacheService.get<GlobalBriefingData>(globalKey);
    if (!global) {
      global = await this.computeGlobalBriefing(z, now, locale);
      await this.cacheService.set(globalKey, global, 30 * 60 * 1000);
    }

    // ── 2. Per-user overlay (greeting, profession insight, transit) ─────
    const userKey = `briefing:user:${userId}:${dateStr}:${hourBucket}:${localeKey}`;
    let overlay = await this.cacheService.get<UserBriefingOverlay>(userKey);
    let userTraditions: string[] = ['VEDIC'];
    // The user record is needed both for the overlay and for the Gochar
    // personalization; fetch it once and reuse.
    let userRecord:
      | { name: string | null; nickname?: string | null; dateOfBirth: Date | null; timeOfBirth: string | null; placeOfBirth: unknown; gender: string | null; profession: string | null; astrologyTraditions?: string[] }
      | null = null;
    if (!overlay) {
      userRecord = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, nickname: true, dateOfBirth: true, timeOfBirth: true, placeOfBirth: true, gender: true, profession: true, astrologyTraditions: true },
      });
      userTraditions = (userRecord as any)?.astrologyTraditions ?? ['VEDIC'];
      overlay = await this.computeUserOverlay(
        userRecord,
        global.canonical,
        global.currentPlanet,
        global.dayRuler,
        global.dayQuality,
        z,
        locale,
      );
      await this.cacheService.set(userKey, overlay, 30 * 60 * 1000);
    }

    // ── 3. Per-user Gochar (transit) personalization ────────────────────
    // Cached separately so a cold overlay cache doesn't force a chart recompute
    // and vice-versa. Falls back to null (→ shared almanac) when the ephemeris
    // is unavailable or the user has no usable birth data.
    let personal: GocharPersonalization | null = null;
    let reason: PersonalizationReason = 'unavailable';
    if (this.gocharService) {
      // v2 key: the cached value now carries the personalization reason too.
      const personalKey = `briefing:gochar:v2:${userId}:${dateStr}:${hourBucket}`;
      const cached = await this.cacheService.get<{ personal: GocharPersonalization | null; reason: PersonalizationReason }>(personalKey);
      if (cached) {
        personal = cached.personal;
        reason = cached.reason;
      } else {
        if (!userRecord) {
          userRecord = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, nickname: true, dateOfBirth: true, timeOfBirth: true, placeOfBirth: true, gender: true, profession: true, astrologyTraditions: true },
          });
        }
        personal = userRecord
          ? await this.gocharService.computePersonalization(
              { dateOfBirth: userRecord.dateOfBirth, timeOfBirth: userRecord.timeOfBirth, placeOfBirth: userRecord.placeOfBirth },
              now,
            )
          : null;
        reason = this.computePersonalizationReason(userRecord, personal);
        await this.cacheService.set(personalKey, { personal, reason }, 30 * 60 * 1000);
      }
    } else {
      // Ephemeris service not wired — every user gets the shared almanac.
      reason = 'unavailable';
    }

    // ── 4. Merge into final response (personalization overrides global) ──
    const summary = personal
      ? `${personal.summaryInsight} ${overlay.summary}`
      : overlay.summary;

    // Personalized do/avoid: lead each list with the user's own chart guidance,
    // then the shared day-ruler/hora almanac (deduped). Keeps the almanac's
    // substance while putting the user's sky first. The lead clause localizes
    // through the same KB briefing-phrase layer as the rest of the briefing
    // prose (English `guidanceDo/Avoid` is the fallback when the KB row is cold),
    // so a non-English personalized list isn't led by an English clause once the
    // guidance phrases are seeded.
    let doList = global.doList;
    let avoidList = global.avoidList;
    if (personal) {
      const [doLead, avoidLead] = await Promise.all([
        this.resolveBriefingPhrase(personal.guidanceDoKey, personal.guidanceDo, locale),
        this.resolveBriefingPhrase(personal.guidanceAvoidKey, personal.guidanceAvoid, locale),
      ]);
      doList = [...new Set([doLead, ...global.doList])].slice(0, 6);
      avoidList = [...new Set([avoidLead, ...global.avoidList])].slice(0, 5);
    }

    // Personalized remedy/mantra: remedy the graha most relevant to the user's
    // transits today (Saturn during Sade Sati, the Moon when afflicted, else the
    // chart ruler) instead of only the shared day-ruler.
    let remedy = global.remedy;
    let mantra = global.mantra;
    if (personal) {
      const rm = await this.resolvePlanetRemedyMantra(personal.focusGraha, locale);
      remedy = rm.remedy;
      mantra = rm.mantra;
    }

    // Personalized lucky time: the next hora ruled by the user's Moon-sign lord,
    // when one is present in today's hours; otherwise the shared window.
    const luckyTime = personal
      ? this.pickPersonalLuckyTime(global.planetaryHours, personal.moonSignLord) ?? global.luckyTime
      : global.luckyTime;

    return {
      greeting: overlay.greeting,
      date: dateStr,
      dayQuality: personal?.dayQuality ?? global.dayQuality,
      summary,
      doList,
      avoidList,
      planetaryHours: global.planetaryHours,
      currentHora: global.currentHora,
      luckyColor: personal?.luckyColor ?? global.luckyColor,
      luckyNumber: personal?.luckyNumber ?? global.luckyNumber,
      luckyTime,
      professionInsight: overlay.professionInsight,
      remedy,
      mantra,
      panchang: global.panchang,
      // When personalization is available it is authoritative for the transit
      // (a null means "no notable transit today" — don't fall back to the
      // approximate age-based alert in that case).
      transitAlert: personal ? personal.transitAlert : overlay.transitAlert,
      personalized: !!personal,
      personalizationReason: reason,
      moonSign: personal?.moonSign ?? null,
      astrologyTraditions: userTraditions,
    };
  }

  /** Classify why the chart layer is / isn't active, for the client's prompt. */
  private computePersonalizationReason(
    userRecord: { dateOfBirth: Date | null; timeOfBirth: string | null; placeOfBirth: unknown } | null,
    personal: GocharPersonalization | null,
  ): PersonalizationReason {
    if (personal) return 'ok';
    if (!userRecord?.dateOfBirth) return 'no_birth_data';
    if (!userRecord.timeOfBirth) return 'missing_time';
    const pob = userRecord.placeOfBirth as { lat?: unknown; lng?: unknown } | null;
    const lat = pob ? Number(pob.lat) : NaN;
    const lng = pob ? Number(pob.lng) : NaN;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    if (!hasCoords) return 'missing_place';
    // All data present but the chart still didn't compute (ephemeris error).
    return 'unavailable';
  }

  /** Localize a briefing phrase by key, falling back to the given English text
   *  when the KB row is cold — the same contract used for the summary template,
   *  quality descriptions and transit alerts. */
  private async resolveBriefingPhrase(key: string, fallback: string, locale?: string): Promise<string> {
    const row = await this.kbService.getBriefingPhrase(key);
    return this.kbService.render(row, locale)?.text ?? fallback;
  }

  /** Resolve a planet's remedy + mantra from the KB (localized), falling back to
   *  the built-in English defaults when the KB row is unreachable. */
  private async resolvePlanetRemedyMantra(
    planet: string,
    locale?: string,
  ): Promise<{ remedy: string; mantra: string }> {
    const rendered = this.kbService.render(await this.kbService.getPlanet(planet), locale);
    return {
      remedy: rendered?.remedy ?? DEFAULT_REMEDIES[planet] ?? DEFAULT_REMEDIES.Sun,
      mantra: rendered?.mantra ?? DEFAULT_MANTRAS[planet] ?? DEFAULT_MANTRAS.Sun,
    };
  }

  /** The window of the next/current hora ruled by `planet`, as "start - end". */
  private pickPersonalLuckyTime(hours: PlanetaryHour[], planet: string): string | null {
    // Prefer the current hora if it's the user's, else the first upcoming one,
    // else any occurrence in the day.
    const current = hours.find((h) => h.isCurrent && h.planet === planet);
    const match = current ?? hours.find((h) => h.planet === planet);
    return match ? `${match.startTime} - ${match.endTime}` : null;
  }

  // ─── Global briefing: identical for every user in the same 30-min slot ──
  private async computeGlobalBriefing(z: ZonedNow, now: Date, locale?: string): Promise<GlobalBriefingData> {
    const dayOfWeek = z.weekday;
    const dayRuler = DAY_RULERS[dayOfWeek];

    const canonical = await this.getPanchangCanonical(now, z);

    // Preload the 7 planet KB rows once; reused for lucky color, day
    // activities, hora activities, and planetary-hours localization.
    const uniquePlanets = Array.from(new Set([...HORA_ORDER, ...DAY_RULERS]));
    const planetRows = await Promise.all(uniquePlanets.map((p) => this.kbService.getPlanet(p)));
    const planetRowByKey = new Map<string, Awaited<ReturnType<KbService['getPlanet']>>>();
    uniquePlanets.forEach((p, i) => planetRowByKey.set(p, planetRows[i]));
    const planetActivities = (planet: string) => {
      const row = planetRowByKey.get(planet);
      const rendered = this.kbService.render(row ?? null, locale);
      if (rendered) return { do: rendered.doList, avoid: rendered.avoidList };
      return PLANET_ACTIVITIES[planet] || PLANET_ACTIVITIES.Sun;
    };

    const planetaryHours = this.calculatePlanetaryHours(dayOfWeek, z.hour * 60 + z.minute, planetActivities);
    const currentHora = planetaryHours.find((h) => h.isCurrent) || null;
    const currentPlanet = currentHora?.planet || dayRuler;

    const panchang = await this.localizePanchang(canonical, locale);
    const dayQuality = this.assessDayQuality(dayRuler, canonical);

    const dayActivities = planetActivities(dayRuler);
    const horaActivities = planetActivities(currentPlanet);
    const doList = [...new Set([...dayActivities.do.slice(0, 3), ...horaActivities.do.slice(0, 2)])];
    const avoidList = [...new Set([...dayActivities.avoid, ...horaActivities.avoid.slice(0, 1)])];

    const dayRulerRendered = this.kbService.render(planetRowByKey.get(dayRuler) ?? null, locale);
    const luckyColor = dayRulerRendered?.color ?? DEFAULT_PLANET_COLORS[dayRuler] ?? 'White';
    const remedy = dayRulerRendered?.remedy ?? DEFAULT_REMEDIES[dayRuler] ?? DEFAULT_REMEDIES.Sun;
    const mantra = dayRulerRendered?.mantra ?? DEFAULT_MANTRAS[dayRuler] ?? DEFAULT_MANTRAS.Sun;

    const dayOfYear = Math.floor((Date.UTC(z.year, z.month - 1, z.day) - Date.UTC(z.year, 0, 0)) / 86400000);
    const luckyNumber = ((dayOfYear + dayOfWeek) % 9) + 1;
    const luckyTime = currentHora ? `${currentHora.startTime} - ${currentHora.endTime}` : '10:00 AM - 11:30 AM';

    return {
      dayRuler, currentPlanet, dayQuality, doList, avoidList,
      planetaryHours, currentHora, luckyColor, luckyNumber, luckyTime,
      remedy, mantra, panchang, canonical,
    };
  }

  // ─── Per-user overlay: personalized fields only ─────────────────────────
  private async computeUserOverlay(
    user: { name: string | null; nickname?: string | null; dateOfBirth: Date | null; profession: string | null } | null,
    canonical: PanchangCanonical,
    currentPlanet: string,
    dayRuler: string,
    dayQuality: DailyBriefingResult['dayQuality'],
    z: ZonedNow,
    locale?: string,
  ): Promise<UserBriefingOverlay> {
    const profession = (user?.profession as string) || 'OTHER';
    // Prefer the user's informal nickname for the greeting ("Good
    // Morning, Sums!"); fall back to the first name from their formal
    // `name`, then to "there" if neither exists. The formal name is
    // still used inside astrology artefacts (kundli, matching, etc.).
    const userName =
      user?.nickname?.trim() ||
      user?.name?.split(' ')[0] ||
      'there';

    const timeKey = greetingKeyForHour(z.hour);
    const qualityKey: `quality.${DailyBriefingResult['dayQuality']}` = `quality.${dayQuality}`;

    const [greetingRow, qualityRow, summaryRow, insightRow, otherInsightRow, dayRulerPlanetRow, varaRow, nakshatraRow] = await Promise.all([
      this.kbService.getBriefingPhrase(timeKey),
      this.kbService.getBriefingPhrase(qualityKey),
      this.kbService.getBriefingPhrase('summary.template'),
      this.kbService.getProfessionInsight(profession, currentPlanet),
      this.kbService.getProfessionInsight('OTHER', currentPlanet),
      this.kbService.getPlanet(dayRuler),
      this.kbService.getVara(canonical.varaKey),
      this.kbService.getNakshatra(canonical.nakshatraKey),
    ]);

    const timeGreeting = this.kbService.render(greetingRow, locale)?.text
      ?? DEFAULT_GREETING_MAP[timeKey];
    const greeting = `${timeGreeting}, ${userName}!`;

    const qualityDesc = this.kbService.render(qualityRow, locale)?.text
      ?? DEFAULT_QUALITY_DESC[dayQuality];

    const professionInsight = this.kbService.render(insightRow, locale)?.insight
      ?? this.kbService.render(otherInsightRow, locale)?.insight
      ?? DEFAULT_PROFESSION_INSIGHTS[profession]?.[currentPlanet]
      ?? DEFAULT_PROFESSION_INSIGHTS.OTHER[currentPlanet]
      ?? 'Focus on your core strengths today.';

    const summaryTemplate = this.kbService.render(summaryRow, locale)?.text
      ?? DEFAULT_SUMMARY_TEMPLATE;

    const dayRulerName = this.kbService.render(dayRulerPlanetRow, locale)?.name ?? dayRuler;
    const varaName = this.kbService.render(varaRow, locale)?.name ?? canonical.varaKey;
    const nakshatraPayload = this.kbService.render(nakshatraRow, locale);
    const nakshatraName = nakshatraPayload?.name ?? canonical.nakshatraKey;
    const nakshatraQuality = nakshatraPayload?.quality ?? this.getNakshatraQuality(canonical.nakshatraKey);

    const summary = summaryTemplate
      .replace('{quality_desc}', qualityDesc)
      .replace('{vara}', varaName)
      .replace('{day_ruler}', dayRulerName)
      .replace('{nakshatra}', nakshatraName)
      .replace('{nakshatra_quality}', nakshatraQuality)
      .replace('{insight}', professionInsight);

    let transitAlert: string | null = null;
    if (user?.dateOfBirth) {
      transitAlert = await this.getTransitAlert(user.dateOfBirth, z, locale);
    }

    return { greeting, professionInsight, summary, transitAlert };
  }

  async getPlanetaryHoursOnly(timeZone?: string): Promise<PlanetaryHour[]> {
    const z = zonedNow(new Date(), isValidTimeZone(timeZone) ? timeZone : DEFAULT_TZ);
    return this.calculatePlanetaryHours(
      z.weekday,
      z.hour * 60 + z.minute,
      (p) => PLANET_ACTIVITIES[p] || PLANET_ACTIVITIES.Sun,
    );
  }

  private calculatePlanetaryHours(
    dayOfWeek: number,
    nowMinutes: number,
    activitiesFor: (planet: string) => { do: string[]; avoid: string[] },
  ): PlanetaryHour[] {
    // Approximate sunrise 6:00 AM, sunset 6:00 PM (India)
    const sunriseMinutes = 6 * 60;
    const sunsetMinutes = 18 * 60;
    const dayDuration = sunsetMinutes - sunriseMinutes;
    const nightDuration = 24 * 60 - dayDuration;
    const dayHourLength = dayDuration / 12;
    const nightHourLength = nightDuration / 12;

    // Day hora sequence starts with the day ruler
    const startIdx = HORA_ORDER.indexOf(DAY_RULERS[dayOfWeek]);

    const hours: PlanetaryHour[] = [];

    // The night hours run past midnight (slot minutes 1080–1800), so a time
    // between local midnight and sunrise (nowMinutes 0–360) belongs to the
    // PREVIOUS night cycle — shift it forward a day to match, otherwise no hora
    // is ever marked current between midnight and 06:00.
    const effectiveNow = nowMinutes < sunriseMinutes ? nowMinutes + 24 * 60 : nowMinutes;

    for (let i = 0; i < 24; i++) {
      const planetIdx = (startIdx + i) % 7;
      const planet = HORA_ORDER[planetIdx];
      const isDay = i < 12;
      const hourLength = isDay ? dayHourLength : nightHourLength;
      const baseMinutes = isDay ? sunriseMinutes : sunsetMinutes;
      const hourInPeriod = isDay ? i : i - 12;

      const startMin = Math.round(baseMinutes + hourInPeriod * hourLength);
      const endMin = Math.round(baseMinutes + (hourInPeriod + 1) * hourLength);

      const isCurrent = effectiveNow >= startMin && effectiveNow < endMin;

      const { do: doList, avoid } = activitiesFor(planet);

      hours.push({
        planet,
        startTime: this.minutesToTime(startMin),
        endTime: this.minutesToTime(endMin),
        activities: doList.slice(0, 3),
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

  /**
   * Panchang from the real Swiss Ephemeris when available, falling back to the
   * approximate mean-longitude computation if the ephemeris errors or is absent.
   * Astronomical elements (tithi/nakshatra/yoga) come from the real instant
   * `now`; the civil weekday (vara) and rahukaal are pinned to the user's LOCAL
   * day via `z`, so they always agree with the displayed date.
   */
  private async getPanchangCanonical(now: Date, z: ZonedNow): Promise<PanchangCanonical> {
    let base: PanchangCanonical;
    if (this.gocharService) {
      try {
        base = await this.gocharService.computeEphemerisPanchang(now);
      } catch (err) {
        this.logger.warn(`Ephemeris panchang failed, using approximate: ${(err as Error)?.message ?? err}`);
        base = this.getBasicPanchang(z);
      }
    } else {
      base = this.getBasicPanchang(z);
    }
    return { ...base, varaKey: VARA_KEYS[z.weekday], rahukaal: RAHU_KAALS[z.weekday] };
  }

  private getBasicPanchang(z: ZonedNow): PanchangCanonical {
    const tithis = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
    const nakshatras = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
    const yogas = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarman', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];

    // Compute Julian Day for astronomical calculations (local calendar date)
    const year = z.year;
    const month = z.month;
    const day = z.day;
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    const jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    const T = (jd - 2451545.0) / 36525.0;

    // Mean Sun and Moon longitudes
    const sunLong = (280.46646 + 36000.76983 * T) % 360;
    const moonLong = (218.3165 + 481267.8813 * T) % 360;
    const ayanamsa = 23.85 + (T * 36525 * 50.29) / 3600;

    // Tithi from Moon-Sun elongation (12° per tithi)
    const elongation = ((moonLong - sunLong) % 360 + 360) % 360;
    const tithiIdx = Math.floor(elongation / 12) % 30;
    const pakshaKey = tithiIdx < 15 ? 'Shukla' : 'Krishna';

    // Nakshatra from Moon's sidereal longitude
    const moonSidereal = ((moonLong - ayanamsa) % 360 + 360) % 360;
    const nakIdx = Math.floor(moonSidereal / (360 / 27)) % 27;

    // Yoga from sum of sidereal Sun + Moon
    const sunSidereal = ((sunLong - ayanamsa) % 360 + 360) % 360;
    const yogaAngle = ((moonSidereal + sunSidereal) % 360 + 360) % 360;
    const yogaIdx = Math.floor(yogaAngle / (360 / 27)) % 27;

    return {
      pakshaKey,
      // tithiIdx 29 is the new moon (Amavasya); % 15 would mislabel it 'Purnima'.
      tithiKey: tithiIdx === 29 ? 'Amavasya' : tithis[tithiIdx % 15],
      nakshatraKey: nakshatras[nakIdx],
      yogaKey: yogas[yogaIdx],
      varaKey: VARA_KEYS[z.weekday],
      rahukaal: RAHU_KAALS[z.weekday],
    };
  }

  private async localizePanchang(
    c: PanchangCanonical,
    locale?: string,
  ): Promise<DailyBriefingResult['panchang']> {
    const [pakshaRow, tithiRow, nakshatraRow, yogaRow, varaRow] = await Promise.all([
      this.kbService.getPaksha(c.pakshaKey),
      this.kbService.getTithi(c.tithiKey),
      this.kbService.getNakshatra(c.nakshatraKey),
      this.kbService.getYoga(c.yogaKey),
      this.kbService.getVara(c.varaKey),
    ]);
    const pakshaName = this.kbService.render(pakshaRow, locale)?.name ?? c.pakshaKey;
    const tithiName = this.kbService.render(tithiRow, locale)?.name ?? c.tithiKey;
    const nakshatraName = this.kbService.render(nakshatraRow, locale)?.name ?? c.nakshatraKey;
    const yogaName = this.kbService.render(yogaRow, locale)?.name ?? c.yogaKey;
    // For varas, keep the bilingual "Ravivaar (Sunday)" form in English for
    // backward-compat with existing frontend components; other locales show
    // just the localized name.
    const varaEnName = this.kbService.render(varaRow, 'en')?.name;
    const varaLocName = this.kbService.render(varaRow, locale)?.name;
    let vara: string;
    if (!locale || locale === 'en') {
      vara = varaEnName ? `${c.varaKey} (${varaEnName})` : c.varaKey;
    } else {
      vara = varaLocName ?? c.varaKey;
    }

    return {
      tithi: `${pakshaName} ${tithiName}`,
      nakshatra: nakshatraName,
      yoga: yogaName,
      vara,
      rahukaal: c.rahukaal,
    };
  }

  private assessDayQuality(dayRuler: string, c: PanchangCanonical): 'excellent' | 'good' | 'moderate' | 'challenging' {
    let score = 3; // baseline

    // Benefic day rulers boost score
    if (['Jupiter', 'Venus', 'Mercury'].includes(dayRuler)) score++;
    if (['Saturn', 'Mars'].includes(dayRuler)) score--;

    // Auspicious tithis
    const auspiciousTithis = ['Panchami', 'Dashami', 'Purnima', 'Dwitiya', 'Saptami'];
    if (auspiciousTithis.includes(c.tithiKey)) score++;

    // Auspicious nakshatras
    const auspiciousNak = ['Rohini', 'Pushya', 'Ashwini', 'Hasta', 'Shravana', 'Revati'];
    if (auspiciousNak.includes(c.nakshatraKey)) score++;

    // Challenging nakshatras
    const challengingNak = ['Ardra', 'Ashlesha', 'Mula', 'Jyeshtha'];
    if (challengingNak.includes(c.nakshatraKey)) score--;

    if (score >= 5) return 'excellent';
    if (score >= 4) return 'good';
    if (score >= 3) return 'moderate';
    return 'challenging';
  }

  // Canonical English nakshatra quality — used only as an en fallback when
  // the KB row is unreachable. The steady-state path reads
  // `KbNakshatra.i18n[locale].quality`.
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
      Mula: 'foundational and transformative',
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

  private async getTransitAlert(dateOfBirth: Date, z: ZonedNow, locale?: string): Promise<string | null> {
    const dob = new Date(dateOfBirth);
    const age = z.year - dob.getFullYear();
    const month = z.month - 1; // 0-based, matching the previous Date#getMonth()

    let transitKey: string | null = null;
    if (age >= 28 && age <= 30) {
      transitKey = 'transit.saturn_return';
    } else if (age % 12 === 0 || age % 12 === 1) {
      transitKey = 'transit.jupiter_return';
    } else {
      // Rahu-Ketu transit (~18 months cycle)
      const monthCycle = (month + age) % 18;
      if (monthCycle === 0) transitKey = 'transit.rahu_ketu';
    }

    if (!transitKey) return null;
    const row = await this.kbService.getBriefingPhrase(transitKey);
    return this.kbService.render(row, locale)?.text ?? DEFAULT_TRANSIT_TEMPLATES[transitKey];
  }
}
