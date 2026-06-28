import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import {
  FeatureAccessService,
  EntitlementTypeName,
  UnlockMode,
} from '../../common/feature-access/feature-access.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { KbService } from '../../knowledge/kb.service';
import { getLocaleInstruction } from '../../common/locale';
import { REPORT_QUEUE } from '../../queue/queue.constants';
import type { ReportJobData } from '../../queue/report.processor';

export interface GenerateReportDto {
  type: 'LIFE' | 'CAREER' | 'MARRIAGE' | 'WEALTH' | 'PALM' | 'ANNUAL';
  birthDetails?: {
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: string;
  };
  locale?: string;
}

export interface ReportResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  status: string;
  summary: string;
  sections: ReportSection[];
  pdfUrl?: string | null;
  creditsCharged: number;
  createdAt: string;
  completedAt?: string;
}

export interface ReportSection {
  title: string;
  content: string;
  order: number;
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  private readonly queueEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private featureAccess: FeatureAccessService,
    private openaiService: OpenAIService,
    private knowledgeService: KnowledgeService,
    private kbService: KbService,
    @Optional() @InjectQueue(REPORT_QUEUE) private reportQueue?: Queue<ReportJobData>,
  ) {
    this.queueEnabled = this.configService.get<string>('QUEUE_ENABLED', 'false') === 'true' && !!this.reportQueue;
  }

  async generateReport(userId: string, dto: GenerateReportDto): Promise<ReportResponse> {
    this.logger.log(`Generating ${dto.type} report for user: ${userId}`);
    // Reports are pay-to-unlock: a subscriber (Mode B) gets it free, else
    // the user must hold an unused one-time entitlement. resolveUnlock
    // throws 402 (PaymentRequired) when neither path is available, which
    // the web turns into a checkout redirect. The entitlement is consumed
    // inside runReportGeneration, only after the Report row exists, so a
    // failed generation never silently burns the unlock.
    const entType = `REPORT_${dto.type}` as EntitlementTypeName;

    // Legacy (credits on): pay-to-unlock per report type via one-time
    // entitlement / subscription (unchanged).
    if (await this.featureAccess.creditsEnabled()) {
      const mode = await this.featureAccess.resolveUnlock(userId, entType);
      return this.runReportGeneration(userId, dto, entType, mode);
    }

    // Subscription model: one report per period — free users once for life,
    // subscribers once per billing month — then it's View-only until the next
    // cycle. The master free switch bypasses the cap.
    if (await this.featureAccess.paidFeaturesFree()) {
      return this.runReportGeneration(userId, dto, entType, 'subscriber');
    }
    const usage = await this.featureAccess.checkUsage(userId, 'report_bundle');
    if (!usage.allowed) {
      throw new PaymentRequiredException(
        usage.isSubscriber
          ? "You've already generated your report this cycle — your next one unlocks next month."
          : 'Subscribe to generate your personalized report.',
        { subscribe: !usage.isSubscriber, feature: 'report_bundle' },
      );
    }
    const result = await this.runReportGeneration(userId, dto, entType, 'subscriber');
    await this.featureAccess.incrementUsage(userId, 'report_bundle', usage.periodKey);
    return result;
  }

  private async runReportGeneration(
    userId: string,
    dto: GenerateReportDto,
    entType: EntitlementTypeName,
    mode: UnlockMode,
  ): Promise<ReportResponse> {
    // Fetch user's profile for personalized reports
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, dateOfBirth: true, timeOfBirth: true, placeOfBirth: true, gender: true },
    });

    const birthDetails = dto.birthDetails || {
      dateOfBirth: user?.dateOfBirth?.toISOString().split('T')[0] || '',
      timeOfBirth: user?.timeOfBirth || '',
      placeOfBirth: (user?.placeOfBirth as any)?.name || '',
    };

    const reportTitles: Record<string, string> = {
      LIFE: 'Detailed Life Analysis Report',
      CAREER: 'Career & Professional Outlook Report',
      MARRIAGE: 'Marriage & Compatibility Report',
      WEALTH: 'Wealth & Financial Forecast Report',
      PALM: 'Palmistry Analysis Report',
      ANNUAL: 'Annual Horoscope Report',
    };

    // Async path: enqueue job, return 202-style response
    if (this.queueEnabled) {
      const report = await this.prisma.report.create({
        data: {
          userId,
          type: dto.type,
          status: 'GENERATING',
          price: 0,
        },
      });

      // Spend the one-time unlock now that the report row exists. Skipped
      // for subscribers (Mode B). If a concurrent request already spent the
      // only unlock, this throws 402 before any LLM cost is incurred.
      if (mode === 'entitlement') {
        await this.featureAccess.consumeEntitlement(userId, entType, report.id);
      }

      try {
        await this.reportQueue!.add('generate', {
          reportId: report.id,
          userId,
          type: dto.type,
          creditCost: 0,
          birthDetails,
          name: user?.name || 'User',
          gender: user?.gender,
          locale: dto.locale,
        } satisfies ReportJobData);
      } catch (err) {
        // The unlock was already spent above; if enqueue fails (e.g. Redis
        // unavailable) the user would be charged for a report that never
        // generates. Refund the entitlement and fail the row so nothing is
        // stranded in GENERATING.
        this.logger.error('Failed to enqueue report job; refunding entitlement', err as Error);
        if (mode === 'entitlement') {
          await this.featureAccess.refundEntitlementByRef(report.id);
        }
        await this.prisma.report.update({
          where: { id: report.id },
          data: { status: 'FAILED' },
        });
        throw new InternalServerErrorException(
          'Could not start report generation. Please try again.',
        );
      }

      return {
        id: report.id,
        userId,
        type: dto.type,
        title: reportTitles[dto.type] || 'Astrology Report',
        status: 'generating',
        summary: `Your ${dto.type.toLowerCase()} report is being generated. Check back shortly.`,
        sections: [],
        creditsCharged: 0,
        createdAt: report.createdAt.toISOString(),
      };
    }

    // Sync path (fallback when QUEUE_ENABLED=false)
    const sections = await this.generateAIReportSections(dto.type, birthDetails, user?.name || 'User', user?.gender, userId, dto.locale);

    const report = await this.prisma.report.create({
      data: {
        userId,
        type: dto.type,
        status: 'READY',
        price: 0,
        fileUrl: JSON.stringify({ sections }),
      },
    });

    if (mode === 'entitlement') {
      await this.featureAccess.consumeEntitlement(userId, entType, report.id);
    }

    return {
      id: report.id,
      userId,
      type: dto.type,
      title: reportTitles[dto.type] || 'Astrology Report',
      status: 'completed',
      summary: sections[0]?.content?.substring(0, 200) + '...' || `Your comprehensive ${dto.type.toLowerCase()} report has been generated.`,
      sections,
      pdfUrl: report.fileUrl,
      creditsCharged: 0,
      createdAt: report.createdAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  async getReportStatus(userId: string, reportId: string): Promise<{ id: string; status: string; completedAt?: string }> {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: { id: true, status: true, createdAt: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    return {
      id: report.id,
      status: report.status.toLowerCase(),
      completedAt: report.status === 'READY' ? report.createdAt.toISOString() : undefined,
    };
  }

  private async regenerateSections(userId: string, type: string): Promise<ReportSection[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, dateOfBirth: true, timeOfBirth: true, placeOfBirth: true, gender: true },
    });
    const birthDetails = {
      dateOfBirth: user?.dateOfBirth?.toISOString().split('T')[0] || '',
      timeOfBirth: user?.timeOfBirth || '',
      placeOfBirth: (user?.placeOfBirth as any)?.name || '',
    };
    return this.generateAIReportSections(type, birthDetails, user?.name || 'User', user?.gender, userId);
  }

  private async generateAIReportSections(
    type: string,
    birthDetails: { dateOfBirth: string; timeOfBirth: string; placeOfBirth: string },
    name: string,
    gender?: string | null,
    userId?: string,
    locale?: string,
  ): Promise<ReportSection[]> {
    if (!birthDetails.dateOfBirth) {
      return this.loadFallbackSections(type, name, locale);
    }

    try {
      // Fetch relevant KB context based on report type
      const kbCategory = this.mapReportTypeToKB(type);
      const kbResults = await this.knowledgeService.getByCategory(kbCategory, 10);
      const kbContext = this.knowledgeService.assembleContext(kbResults);
      const kbSection = kbContext ? `\n\nReference Knowledge (use this to ground your analysis):\n${kbContext}` : '';

      const sectionStructure = this.getSectionStructure(type);
      const prompt = `Generate a detailed Vedic astrology ${type.toLowerCase()} report for:
Name: ${name}
${gender ? `Gender: ${gender}` : ''}
Date of Birth: ${birthDetails.dateOfBirth}
Time of Birth: ${birthDetails.timeOfBirth || 'Unknown'}
Place of Birth: ${birthDetails.placeOfBirth || 'Unknown'}

Return a JSON object with key "sections" containing an array of objects, each with:
- title: string
- content: string (2-3 detailed paragraphs with specific Vedic astrological references)
- order: number

Generate these sections: ${sectionStructure.map((s) => s.title).join(', ')}

Be specific with planetary positions, Dasha periods, Yogas, and transit effects. Use Lahiri ayanamsa. Reference the person by name.${kbSection}`;

      const systemPrompt = 'You are an expert Vedic astrologer creating detailed professional reports. Use accurate Jyotish terminology and provide actionable insights. Return valid JSON.' +
        getLocaleInstruction(locale);

      const result = await this.openaiService.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        maxTokens: 2000,
        temperature: 0.7,
        jsonMode: true,
        userId,
        feature: `report:${type.toLowerCase()}`,
      });

      if (result?.sections && Array.isArray(result.sections)) {
        return result.sections;
      }
    } catch (error) {
      this.logger.error('OpenAI report generation failed, using fallback', error);
    }

    return this.loadFallbackSections(type, name, locale);
  }

  /**
   * Render the 6-section fallback for `type` in the user's locale from
   * KbReportSection. Falls back to the inline English templates when the
   * KB cache is cold (migration not applied / DB unavailable). Both the
   * sync service path and the queue processor go through this.
   */
  private async loadFallbackSections(type: string, name: string, locale?: string): Promise<ReportSection[]> {
    const fallback = this.getFallbackSections(type, name);
    const rows = await Promise.all(
      fallback.map((s) => this.kbService.getReportSection(type, s.order)),
    );
    return fallback.map((s, i) => {
      const payload = this.kbService.render(rows[i], locale);
      const title = payload?.title ?? s.title;
      const content = (payload?.content ?? s.content).replace(/\{name\}/g, name);
      return { title, content, order: s.order };
    });
  }

  private mapReportTypeToKB(type: string): string {
    const map: Record<string, string> = {
      LIFE: 'planets',
      CAREER: 'houses',
      MARRIAGE: 'matching',
      WEALTH: 'yogas',
      PALM: 'palmistry',
      ANNUAL: 'signs',
    };
    return map[type] || 'planets';
  }

  private getSectionStructure(type: string): { title: string }[] {
    const structures: Record<string, { title: string }[]> = {
      LIFE: [
        { title: 'Birth Chart Overview' },
        { title: 'Planetary Positions & Houses' },
        { title: 'Current Dasha Period Analysis' },
        { title: 'Key Yogas & Their Effects' },
        { title: 'Life Path & Destiny' },
        { title: 'Remedies & Recommendations' },
      ],
      CAREER: [
        { title: 'Professional Profile' },
        { title: 'Dashamsha (D10) Chart Analysis' },
        { title: 'Current Career Transit' },
        { title: 'Best Career Paths' },
        { title: 'Financial Outlook' },
        { title: 'Career Remedies & Timing' },
      ],
      MARRIAGE: [
        { title: 'Relationship Profile' },
        { title: 'Navamsa Chart Analysis' },
        { title: '7th House & Venus Analysis' },
        { title: 'Marriage Timing' },
        { title: 'Partner Compatibility Indicators' },
        { title: 'Relationship Remedies' },
      ],
      WEALTH: [
        { title: 'Financial Birth Chart Analysis' },
        { title: '2nd & 11th House Study' },
        { title: 'Dhana Yogas' },
        { title: 'Investment & Timing' },
        { title: 'Wealth Growth Periods' },
        { title: 'Financial Remedies' },
      ],
      PALM: [
        { title: 'Palm Lines Overview' },
        { title: 'Heart Line Analysis' },
        { title: 'Head Line Analysis' },
        { title: 'Life Line Analysis' },
        { title: 'Mount Analysis' },
        { title: 'Overall Reading & Guidance' },
      ],
      ANNUAL: [
        { title: 'Year Overview' },
        { title: 'Quarter 1 Forecast (Jan-Mar)' },
        { title: 'Quarter 2 Forecast (Apr-Jun)' },
        { title: 'Quarter 3 Forecast (Jul-Sep)' },
        { title: 'Quarter 4 Forecast (Oct-Dec)' },
        { title: 'Annual Remedies & Lucky Periods' },
      ],
    };

    return structures[type] || structures.LIFE;
  }

  // English fallback sections — used only when the KB cache is cold
  // (migration not applied / DB unavailable). Authoritative data is in
  // KbReportSection; `{name}` placeholders are substituted by
  // loadFallbackSections at render time.
  private getFallbackSections(type: string, name: string): ReportSection[] {
    const sub = (content: string) => content.replace(/\{name\}/g, name);
    const sections: Record<string, ReportSection[]> = {
      LIFE: [
        { title: 'Birth Chart Overview', content: sub("{name}, your Vedic birth chart reveals a person of determination and emotional depth. The Lagna (Ascendant) lord's placement indicates strong self-expression and leadership potential. Your chart shows a balance between material pursuits and spiritual growth."), order: 1 },
        { title: 'Planetary Analysis', content: sub("The key planetary influences in your chart include Jupiter's beneficial aspect on your Kendra houses, suggesting wisdom and prosperity. Saturn's placement indicates disciplined growth through patience. Venus and Mercury's positions favor creative and intellectual pursuits."), order: 2 },
        { title: 'Current Dasha Period', content: sub("The current Mahadasha period brings opportunities for personal transformation. Focus on long-term goals and investments during this transit. The sub-period (Antardasha) highlights relationships and social connections. This is a favorable time for education and skill development."), order: 3 },
        { title: 'Key Yogas', content: sub("Your chart shows the formation of significant Yogas that influence your life path. The presence of beneficial Yogas in Kendra houses suggests prosperity and wisdom. These planetary combinations indicate success through righteous actions and intellectual pursuits."), order: 4 },
        { title: 'Life Path & Destiny', content: sub("{name}, your life path is characterized by a journey of growth, learning, and meaningful contributions. The planetary alignments suggest peaks of achievement interspersed with periods of introspection. Your destiny points toward a life of influence and positive impact on those around you."), order: 5 },
        { title: 'Remedies & Recommendations', content: sub("To strengthen beneficial planetary influences: practice meditation during Brahma Muhurat (4:00-5:30 AM), consult an astrologer for gemstone recommendations suited to your Lagna, perform charitable acts on Saturdays, and chant mantras dedicated to your ruling planet. Regular Surya Namaskar practice will energize the Sun's positive influence in your chart."), order: 6 },
      ],
      CAREER: [
        { title: 'Professional Profile', content: sub("{name}, your birth chart indicates strong professional potential. You possess natural leadership abilities and analytical thinking. The 10th house configuration suggests success in fields requiring discipline and strategic planning."), order: 1 },
        { title: 'Dashamsha Chart Analysis', content: sub("The D10 (Dashamsha) chart reveals your career destiny. The 10th lord's placement suggests advancement through merit and persistent effort. Current transits favor professional growth, especially in technology, management, or advisory roles."), order: 2 },
        { title: 'Current Career Transit', content: sub("Jupiter's favorable transit activates your career sector, bringing opportunities for advancement. Saturn's steady influence supports building long-term professional foundations. The next 12 months show promise for promotion or new ventures."), order: 3 },
        { title: 'Best Career Paths', content: sub("Based on your chart, careers in leadership, finance, technology, healthcare, or education align with your planetary strengths. Your Mercury placement particularly favors communication-heavy roles. Creative fields also show promise with Venus's beneficial aspect."), order: 4 },
        { title: 'Financial Outlook', content: sub("The 2nd and 11th house placements indicate steady income growth. Investments made during Jupiter's transit through your wealth houses will yield positive returns. Avoid speculative ventures during Rahu's unfavorable aspects."), order: 5 },
        { title: 'Career Remedies', content: sub("Strengthen your career prospects by: chanting the Gayatri Mantra daily, wearing a Yellow Sapphire (after astrological consultation), donating to educational causes on Thursdays, and beginning important professional undertakings during favorable Muhurat periods."), order: 6 },
      ],
      MARRIAGE: [
        { title: 'Relationship Profile', content: sub("{name}, your Navamsa chart reveals your approach to relationships and marriage. Your emotional nature indicates deep loyalty and a desire for meaningful connections. Venus's placement shows your capacity for love and partnership."), order: 1 },
        { title: 'Navamsa Chart Analysis', content: sub("The D9 (Navamsa) chart is crucial for marriage analysis. Your Navamsa Lagna and its lord's placement suggest a harmonious married life with mutual respect. The 7th house configuration indicates a partner who complements your strengths."), order: 2 },
        { title: '7th House & Venus Analysis', content: sub("Venus's sign and house placement in your chart governs romantic inclinations. The 7th lord's dignity suggests a stable, supportive partner. Any planetary aspects on the 7th house indicate the nature and timing of significant relationships."), order: 3 },
        { title: 'Marriage Timing', content: sub("Based on Dasha periods and transits, favorable periods for marriage align with Jupiter and Venus Dashas. The current transit suggests relationship developments in the coming months. Look for Muhurat periods when Venus and Jupiter aspect your 7th house."), order: 4 },
        { title: 'Partner Compatibility', content: sub("Your ideal partner's Moon sign and Nakshatra should complement your own for Ashtakoota compatibility. The chart suggests compatibility with partners who share intellectual curiosity and emotional depth. A partner with complementary elemental energy will create the most harmonious union."), order: 5 },
        { title: 'Relationship Remedies', content: sub("To attract and maintain healthy relationships: worship Lord Shiva and Parvati together on Mondays, wear a Diamond or White Sapphire (Venus gemstone) after consultation, fast on Fridays, and chant the Shukra Beej Mantra for Venus's blessings."), order: 6 },
      ],
      WEALTH: [
        { title: 'Financial Chart Analysis', content: sub("{name}, your birth chart's wealth indicators show promising financial potential. The 2nd house (accumulated wealth) and 11th house (income) configurations suggest steady financial growth through career and investments."), order: 1 },
        { title: '2nd & 11th House Study', content: sub("The lords of your 2nd and 11th houses and their planetary dignity determine your wealth trajectory. Benefic aspects on these houses indicate financial stability, while the Dasha of these lords brings peak earning periods."), order: 2 },
        { title: 'Dhana Yogas', content: sub("Your chart contains wealth-producing Yogas (Dhana Yogas) formed by the conjunction or mutual aspect of specific house lords. These Yogas activate during favorable Dasha periods, bringing financial windfalls and prosperity."), order: 3 },
        { title: 'Investment Timing', content: sub("The best periods for investments align with Jupiter and Venus transits through your wealth houses. Avoid speculative investments during Rahu-Ketu axis activations. Long-term investments made during favorable Muhurat will yield the best returns."), order: 4 },
        { title: 'Wealth Growth Periods', content: sub("The coming years show financial growth peaks during specific Dasha transitions. Save and invest during Saturn's productive transits, and expand during Jupiter's wealth-house transits. Real estate investments are particularly favored."), order: 5 },
        { title: 'Financial Remedies', content: sub("Enhance financial prosperity by: keeping a Kuber Yantra in your safe, chanting the Lakshmi Mantra on Fridays, donating to charity on auspicious days, wearing a Yellow Sapphire for Jupiter's blessings (after consultation), and beginning financial ventures during Pushya Nakshatra."), order: 6 },
      ],
      PALM: [
        { title: 'Palm Lines Overview', content: sub("{name}, your palm analysis reveals a fascinating combination of lines and patterns. The major lines on your palm indicate a life of purpose, emotional depth, and intellectual vigor. The clarity and depth of your lines suggest strong life force energy and determination."), order: 1 },
        { title: 'Heart Line Analysis', content: sub("Your heart line indicates a passionate and emotionally expressive nature. The length and curvature suggest a balance between emotional openness and thoughtful selectivity in relationships. Deep, unbroken lines point toward meaningful, lasting connections."), order: 2 },
        { title: 'Head Line Analysis', content: sub("The head line on your palm shows strong analytical abilities and clear thinking patterns. Its trajectory indicates a blend of logical reasoning and creative imagination. This suggests success in careers requiring both intellectual precision and innovative thinking."), order: 3 },
        { title: 'Life Line Analysis', content: sub("Your life line shows strong vitality and resilience. The depth and length indicate a life full of energy and enthusiasm. The curve around the Mount of Venus suggests warmth, generosity, and a zest for living that attracts positive experiences."), order: 4 },
        { title: 'Mount Analysis', content: sub("The mounts on your palm reveal key personality traits. Well-developed mounts indicate areas of strength: Jupiter for ambition, Apollo for creativity, and Venus for love and passion. The balance of your mounts suggests a well-rounded personality with multiple talents."), order: 5 },
        { title: 'Overall Reading & Guidance', content: sub("{name}, your overall palm reading suggests a life of achievement, meaningful relationships, and personal growth. The combination of your major lines, minor lines, and mount development points toward success through self-effort. Practicing mindfulness and staying true to your values will amplify the positive indications in your palm."), order: 6 },
      ],
      ANNUAL: [
        { title: 'Year Overview', content: sub("{name}, the year ahead brings a transformative blend of opportunities and growth. The major planetary transits this year activate key areas of your chart, bringing positive changes in career, relationships, and personal development. Jupiter's beneficial influence highlights expansion and prosperity."), order: 1 },
        { title: 'Quarter 1 Forecast (Jan-Mar)', content: sub("The first quarter sets a strong foundation for the year. Saturn's disciplined energy supports goal-setting and planning. Professional opportunities may arise through networking. Focus on health routines and building new habits during this period. Financial planning initiated now will yield rewards later."), order: 2 },
        { title: 'Quarter 2 Forecast (Apr-Jun)', content: sub("The second quarter brings dynamic energy with Mars activating your career sector. This is an excellent period for launching new projects and taking calculated risks. Relationships deepen as Venus transits favorably. Travel opportunities may arise, bringing both pleasure and business prospects."), order: 3 },
        { title: 'Quarter 3 Forecast (Jul-Sep)', content: sub("Mid-year brings introspection and consolidation. Mercury retrograde periods require careful communication. Focus on completing ongoing projects rather than starting new ones. Family matters take center stage, and property-related decisions are favored. Health improvements show results from earlier efforts."), order: 4 },
        { title: 'Quarter 4 Forecast (Oct-Dec)', content: sub("The final quarter brings the year's strongest results. Jupiter's transit supports financial growth and career advancement. Social connections bring unexpected opportunities. This is an excellent period for investments, celebrations, and long-term commitments. End the year with gratitude and forward planning."), order: 5 },
        { title: 'Annual Remedies & Lucky Periods', content: sub("To maximize this year's potential: perform Ganesha Puja at the year's start, wear gemstones suited to your Lagna after consultation, observe fasting on days ruled by your chart's weakest planet, and chant the Gayatri Mantra daily. Lucky months include those when Jupiter transits your Trikona houses. Special Muhurat periods will be particularly favorable for major decisions."), order: 6 },
      ],
    };

    return sections[type] || sections.LIFE;
  }

  async getReport(userId: string, reportId: string): Promise<ReportResponse> {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
    });

    if (!report) throw new NotFoundException('Report not found');

    // Use stored sections if available, otherwise regenerate (legacy reports)
    let sections: ReportSection[];
    if (report.fileUrl && report.fileUrl.startsWith('{')) {
      try {
        const stored = JSON.parse(report.fileUrl);
        sections = stored.sections;
      } catch {
        sections = await this.regenerateSections(userId, report.type);
      }
    } else {
      sections = await this.regenerateSections(userId, report.type);
    }

    const reportTitles: Record<string, string> = {
      LIFE: 'Detailed Life Analysis Report',
      CAREER: 'Career & Professional Outlook Report',
      MARRIAGE: 'Marriage & Compatibility Report',
      WEALTH: 'Wealth & Financial Forecast Report',
      PALM: 'Palmistry Analysis Report',
      ANNUAL: 'Annual Horoscope Report',
    };

    return {
      id: report.id,
      userId: report.userId,
      type: report.type,
      title: reportTitles[report.type] || `${report.type} Report`,
      status: report.status.toLowerCase(),
      summary: sections[0]?.content?.substring(0, 200) + '...' || `Your ${report.type.toLowerCase()} report.`,
      sections,
      pdfUrl: report.fileUrl,
      creditsCharged: Number(report.price),
      createdAt: report.createdAt.toISOString(),
    };
  }

  async getUserReports(userId: string): Promise<Omit<ReportResponse, 'sections'>[]> {
    const reports = await this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return reports.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      type: r.type,
      title: `${r.type} Report`,
      status: r.status.toLowerCase(),
      summary: `Your ${r.type.toLowerCase()} report.`,
      pdfUrl: r.fileUrl,
      creditsCharged: Number(r.price),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
