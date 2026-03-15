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

    const reportTitles: Record<string, string> = {
      LIFE: 'Detailed Life Analysis Report',
      CAREER: 'Career & Professional Outlook Report',
      MARRIAGE: 'Marriage & Compatibility Report',
      WEALTH: 'Wealth & Financial Forecast Report',
      PALM: 'Palmistry Analysis Report',
      ANNUAL: 'Annual Horoscope Report',
    };

    const sections = [
      { title: 'Executive Summary', content: 'Based on the analysis of your birth chart, the current planetary transits present a period of significant growth and transformation.', order: 1 },
      { title: 'Planetary Analysis', content: 'Jupiter in your 10th house indicates strong career prospects. Saturn\'s influence suggests patience in relationships. Venus transit brings positive financial changes.', order: 2 },
      { title: 'Predictions & Guidance', content: 'The next 12 months show a favorable period for professional growth. The period between March-June is especially auspicious for new ventures.', order: 3 },
      { title: 'Remedies & Recommendations', content: 'Yellow Sapphire can strengthen Jupiter\'s positive influence. Regular meditation during Brahma Muhurat (4:00-5:30 AM) is recommended.', order: 4 },
    ];

    // Save to DB
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
      summary: `Your comprehensive ${dto.type.toLowerCase()} report has been generated based on Vedic astrology principles.`,
      sections,
      pdfUrl: report.fileUrl,
      creditsCharged: creditCost,
      createdAt: report.createdAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
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
