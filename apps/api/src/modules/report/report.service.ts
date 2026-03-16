import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';

export interface GenerateReportDto {
  type: 'LIFE' | 'CAREER' | 'MARRIAGE' | 'WEALTH' | 'PALM' | 'ANNUAL';
  birthDetails?: {
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: string;
  };
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

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  async generateReport(userId: string, dto: GenerateReportDto): Promise<ReportResponse> {
    this.logger.log(`Generating ${dto.type} report for user: ${userId}`);
    const creditCost = this.configService.get<number>('credits.reportCost', 5);

    await this.userService.deductCredits(userId, creditCost, `${dto.type} report generation`);

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

    const sections = await this.generateAIReportSections(dto.type, birthDetails, user?.name || 'User', user?.gender);

    const report = await this.prisma.report.create({
      data: {
        userId,
        type: dto.type,
        status: 'READY',
        price: creditCost,
      },
    });

    return {
      id: report.id,
      userId,
      type: dto.type,
      title: reportTitles[dto.type] || 'Astrology Report',
      status: 'completed',
      summary: sections[0]?.content?.substring(0, 200) + '...' || `Your comprehensive ${dto.type.toLowerCase()} report has been generated.`,
      sections,
      pdfUrl: report.fileUrl,
      creditsCharged: creditCost,
      createdAt: report.createdAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  private async generateAIReportSections(
    type: string,
    birthDetails: { dateOfBirth: string; timeOfBirth: string; placeOfBirth: string },
    name: string,
    gender?: string | null,
  ): Promise<ReportSection[]> {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey || !birthDetails.dateOfBirth) {
      return this.getFallbackSections(type, birthDetails, name);
    }

    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey });

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

Be specific with planetary positions, Dasha periods, Yogas, and transit effects. Use Lahiri ayanamsa. Reference the person by name.`;

      const completion = await openai.chat.completions.create({
        model: this.configService.get<string>('openai.model', 'gpt-4o'),
        messages: [
          { role: 'system', content: 'You are an expert Vedic astrologer creating detailed professional reports. Use accurate Jyotish terminology and provide actionable insights. Return valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 3000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        if (result.sections && Array.isArray(result.sections)) {
          return result.sections;
        }
      }
    } catch (error) {
      this.logger.error('OpenAI report generation failed, using fallback', error);
    }

    return this.getFallbackSections(type, birthDetails, name);
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

  private getFallbackSections(
    type: string,
    birthDetails: { dateOfBirth: string; timeOfBirth: string; placeOfBirth: string },
    name: string,
  ): ReportSection[] {
    const hasBirth = !!birthDetails.dateOfBirth;
    const dob = birthDetails.dateOfBirth ? new Date(birthDetails.dateOfBirth) : new Date();
    const month = dob.getMonth();
    const day = dob.getDate();

    // Derive basic chart info for personalization
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const signIdx = month;
    const sign = signs[signIdx];
    const moonSign = signs[(signIdx + Math.floor(day / 2.5)) % 12];

    const sections: Record<string, ReportSection[]> = {
      LIFE: [
        { title: 'Birth Chart Overview', content: `${name}, your Vedic birth chart with ${hasBirth ? `Sun in ${sign} and Moon in ${moonSign}` : 'your planetary positions'} reveals a person of determination and emotional depth. The Lagna (Ascendant) lord's placement indicates strong self-expression and leadership potential. Your chart shows a balance between material pursuits and spiritual growth.`, order: 1 },
        { title: 'Planetary Analysis', content: `The key planetary influences in your chart include Jupiter's beneficial aspect on your Kendra houses, suggesting wisdom and prosperity. Saturn's placement indicates disciplined growth through patience. ${hasBirth ? `Being born under ${moonSign} Rashi, your emotional intelligence is a core strength.` : ''} Venus and Mercury's positions favor creative and intellectual pursuits.`, order: 2 },
        { title: 'Current Dasha Period', content: `The current Mahadasha period brings opportunities for personal transformation. Focus on long-term goals and investments during this transit. The sub-period (Antardasha) highlights relationships and social connections. This is a favorable time for education and skill development.`, order: 3 },
        { title: 'Key Yogas', content: `Your chart shows the formation of significant Yogas that influence your life path. The presence of beneficial Yogas in Kendra houses suggests prosperity and wisdom. These planetary combinations indicate success through righteous actions and intellectual pursuits.`, order: 4 },
        { title: 'Life Path & Destiny', content: `${name}, your life path is characterized by a journey of growth, learning, and meaningful contributions. The planetary alignments suggest peaks of achievement interspersed with periods of introspection. Your destiny points toward a life of influence and positive impact on those around you.`, order: 5 },
        { title: 'Remedies & Recommendations', content: `To strengthen beneficial planetary influences: practice meditation during Brahma Muhurat (4:00-5:30 AM), ${hasBirth ? `wear gemstones suited to your ${sign} Lagna after consulting an astrologer,` : 'consult an astrologer for gemstone recommendations,'} perform charitable acts on Saturdays, and chant mantras dedicated to your ruling planet. Regular Surya Namaskar practice will energize the Sun's positive influence in your chart.`, order: 6 },
      ],
      CAREER: [
        { title: 'Professional Profile', content: `${name}, your birth chart indicates strong professional potential. ${hasBirth ? `With your ${sign} influence` : 'Your planetary positions'}, you possess natural leadership abilities and analytical thinking. The 10th house configuration suggests success in fields requiring discipline and strategic planning.`, order: 1 },
        { title: 'Dashamsha Chart Analysis', content: `The D10 (Dashamsha) chart reveals your career destiny. The 10th lord's placement suggests advancement through merit and persistent effort. Current transits favor professional growth, especially in technology, management, or advisory roles.`, order: 2 },
        { title: 'Current Career Transit', content: `Jupiter's favorable transit activates your career sector, bringing opportunities for advancement. Saturn's steady influence supports building long-term professional foundations. The next 12 months show promise for promotion or new ventures.`, order: 3 },
        { title: 'Best Career Paths', content: `Based on your chart, careers in leadership, finance, technology, healthcare, or education align with your planetary strengths. Your Mercury placement particularly favors communication-heavy roles. Creative fields also show promise with Venus's beneficial aspect.`, order: 4 },
        { title: 'Financial Outlook', content: `The 2nd and 11th house placements indicate steady income growth. Investments made during Jupiter's transit through your wealth houses will yield positive returns. Avoid speculative ventures during Rahu's unfavorable aspects.`, order: 5 },
        { title: 'Career Remedies', content: `Strengthen your career prospects by: chanting the Gayatri Mantra daily, wearing a Yellow Sapphire (after astrological consultation), donating to educational causes on Thursdays, and beginning important professional undertakings during favorable Muhurat periods.`, order: 6 },
      ],
      MARRIAGE: [
        { title: 'Relationship Profile', content: `${name}, your Navamsa chart reveals your approach to relationships and marriage. ${hasBirth ? `The ${moonSign} Moon sign` : 'Your emotional nature'} indicates deep loyalty and a desire for meaningful connections. Venus's placement shows your capacity for love and partnership.`, order: 1 },
        { title: 'Navamsa Chart Analysis', content: `The D9 (Navamsa) chart is crucial for marriage analysis. Your Navamsa Lagna and its lord's placement suggest a harmonious married life with mutual respect. The 7th house configuration indicates a partner who complements your strengths.`, order: 2 },
        { title: '7th House & Venus Analysis', content: `Venus's sign and house placement in your chart governs romantic inclinations. The 7th lord's dignity suggests a stable, supportive partner. Any planetary aspects on the 7th house indicate the nature and timing of significant relationships.`, order: 3 },
        { title: 'Marriage Timing', content: `Based on Dasha periods and transits, favorable periods for marriage align with Jupiter and Venus Dashas. The current transit suggests relationship developments in the coming months. Look for Muhurat periods when Venus and Jupiter aspect your 7th house.`, order: 4 },
        { title: 'Partner Compatibility', content: `Your ideal partner's Moon sign and Nakshatra should complement your own for Ashtakoota compatibility. The chart suggests compatibility with partners who share intellectual curiosity and emotional depth. A partner with complementary elemental energy will create the most harmonious union.`, order: 5 },
        { title: 'Relationship Remedies', content: `To attract and maintain healthy relationships: worship Lord Shiva and Parvati together on Mondays, wear a Diamond or White Sapphire (Venus gemstone) after consultation, fast on Fridays, and chant the Shukra Beej Mantra for Venus's blessings.`, order: 6 },
      ],
      WEALTH: [
        { title: 'Financial Chart Analysis', content: `${name}, your birth chart's wealth indicators show promising financial potential. The 2nd house (accumulated wealth) and 11th house (income) configurations suggest steady financial growth through career and investments.`, order: 1 },
        { title: '2nd & 11th House Study', content: `The lords of your 2nd and 11th houses and their planetary dignity determine your wealth trajectory. Benefic aspects on these houses indicate financial stability, while the Dasha of these lords brings peak earning periods.`, order: 2 },
        { title: 'Dhana Yogas', content: `Your chart contains wealth-producing Yogas (Dhana Yogas) formed by the conjunction or mutual aspect of specific house lords. These Yogas activate during favorable Dasha periods, bringing financial windfalls and prosperity.`, order: 3 },
        { title: 'Investment Timing', content: `The best periods for investments align with Jupiter and Venus transits through your wealth houses. Avoid speculative investments during Rahu-Ketu axis activations. Long-term investments made during favorable Muhurat will yield the best returns.`, order: 4 },
        { title: 'Wealth Growth Periods', content: `The coming years show financial growth peaks during specific Dasha transitions. Save and invest during Saturn's productive transits, and expand during Jupiter's wealth-house transits. Real estate investments are particularly favored.`, order: 5 },
        { title: 'Financial Remedies', content: `Enhance financial prosperity by: keeping a Kuber Yantra in your safe, chanting the Lakshmi Mantra on Fridays, donating to charity on auspicious days, wearing a Yellow Sapphire for Jupiter's blessings (after consultation), and beginning financial ventures during Pushya Nakshatra.`, order: 6 },
      ],
    };

    return sections[type] || sections.LIFE;
  }

  async getReport(userId: string, reportId: string): Promise<ReportResponse> {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
    });

    if (!report) throw new NotFoundException('Report not found');

    return {
      id: report.id,
      userId: report.userId,
      type: report.type,
      title: `${report.type} Report`,
      status: report.status.toLowerCase(),
      summary: `Your ${report.type.toLowerCase()} report.`,
      sections: [],
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
