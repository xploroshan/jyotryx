import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface GenerateReportDto {
  type: 'kundli' | 'compatibility' | 'career' | 'health' | 'yearly' | 'transit';
  userId: string;
  birthDetails?: {
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: string;
  };
  additionalData?: Record<string, any>;
}

export interface Report {
  id: string;
  userId: string;
  type: string;
  title: string;
  status: 'generating' | 'completed' | 'failed';
  summary: string;
  sections: ReportSection[];
  pdfUrl?: string;
  creditsCharged: number;
  createdAt: string;
  completedAt?: string;
}

export interface ReportSection {
  title: string;
  content: string;
  order: number;
}

// In-memory store for development
const reportsStore: Map<string, Report> = new Map();

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private configService: ConfigService) {}

  async generateReport(userId: string, dto: GenerateReportDto): Promise<Report> {
    this.logger.log(`Generating ${dto.type} report for user: ${userId}`);
    const creditCost = this.configService.get<number>('credits.reportCost', 5);
    // TODO: Deduct credits via UserService

    const reportId = uuidv4();
    const reportTitles: Record<string, string> = {
      kundli: 'Detailed Kundli Analysis Report',
      compatibility: 'Compatibility & Matching Report',
      career: 'Career & Professional Outlook Report',
      health: 'Health & Wellness Astrology Report',
      yearly: 'Annual Horoscope Prediction Report',
      transit: 'Planetary Transit Analysis Report',
    };

    const report: Report = {
      id: reportId,
      userId,
      type: dto.type,
      title: reportTitles[dto.type] || 'Astrology Report',
      status: 'completed',
      summary: `Your comprehensive ${dto.type} report has been generated based on Vedic astrology principles. This report covers planetary positions, key life aspects, and personalized remedies.`,
      sections: [
        {
          title: 'Executive Summary',
          content: 'Based on the analysis of your birth chart, the current planetary transits present a period of significant growth and transformation. Key areas of focus include career advancement, relationship harmony, and spiritual development.',
          order: 1,
        },
        {
          title: 'Planetary Analysis',
          content: 'The placement of Jupiter in your 10th house indicates strong career prospects. Saturn\'s influence on the 7th house suggests the need for patience in relationships. The upcoming Venus transit will bring positive changes in finances.',
          order: 2,
        },
        {
          title: 'Predictions & Guidance',
          content: 'The next 12 months show a favorable period for professional growth. The period between March-June is especially auspicious for new ventures. Avoid major financial decisions during the retrograde periods.',
          order: 3,
        },
        {
          title: 'Remedies & Recommendations',
          content: 'Wearing Yellow Sapphire can strengthen Jupiter\'s positive influence. Regular meditation during Brahma Muhurat (4:00-5:30 AM) is recommended. Donating food on Thursdays will enhance spiritual growth.',
          order: 4,
        },
      ],
      creditsCharged: creditCost,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    reportsStore.set(reportId, report);
    return report;
  }

  async getReport(userId: string, reportId: string): Promise<Report> {
    const report = reportsStore.get(reportId);

    if (!report || report.userId !== userId) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async getUserReports(userId: string): Promise<Omit<Report, 'sections'>[]> {
    // TODO: Replace with Prisma query
    const userReports = Array.from(reportsStore.values())
      .filter((r) => r.userId === userId)
      .map(({ sections, ...rest }) => rest)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return userReports;
  }
}
