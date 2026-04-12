import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { UserService } from '../modules/user/user.service';
import { REPORT_QUEUE } from './queue.module';

export interface ReportJobData {
  reportId: string;
  userId: string;
  type: string;
  creditCost: number;
  birthDetails: { dateOfBirth: string; timeOfBirth: string; placeOfBirth: string };
  name: string;
  gender?: string | null;
}

@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
    private readonly userService: UserService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportId, userId, type, creditCost, birthDetails, name, gender } = job.data;
    this.logger.log(`Processing report job ${job.id} — reportId=${reportId} type=${type}`);

    try {
      const sections = await this.generateSections(type, birthDetails, name, gender, userId);

      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'READY',
          fileUrl: JSON.stringify({ sections }),
        },
      });

      this.logger.log(`Report ${reportId} completed successfully`);
    } catch (error) {
      this.logger.error(`Report ${reportId} failed: ${(error as Error).message}`);

      // Mark as failed in DB
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'FAILED' },
      }).catch(() => {});

      // Refund credits on final attempt
      if (job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        this.logger.log(`Refunding ${creditCost} credits for failed report ${reportId}`);
        await this.userService.addCredits(userId, creditCost, 'PURCHASE', `Refund: ${type} report generation failed`);
      }

      throw error;
    }
  }

  private async generateSections(
    type: string,
    birthDetails: { dateOfBirth: string; timeOfBirth: string; placeOfBirth: string },
    name: string,
    gender?: string | null,
    userId?: string,
  ) {
    if (!birthDetails.dateOfBirth) {
      return this.getFallbackSections(type, name);
    }

    const kbCategoryMap: Record<string, string> = {
      LIFE: 'planets', CAREER: 'houses', MARRIAGE: 'matching',
      WEALTH: 'yogas', PALM: 'palmistry', ANNUAL: 'signs',
    };
    const kbCategory = kbCategoryMap[type] || 'planets';

    const kbResults = await this.knowledgeService.getByCategory(kbCategory, 10);
    const kbContext = this.knowledgeService.assembleContext(kbResults);
    const kbSection = kbContext ? `\n\nReference Knowledge (use this to ground your analysis):\n${kbContext}` : '';

    const sectionTitles = this.getSectionTitles(type);
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

Generate these sections: ${sectionTitles.join(', ')}

Be specific with planetary positions, Dasha periods, Yogas, and transit effects. Use Lahiri ayanamsa. Reference the person by name.${kbSection}`;

    const result = await this.openaiService.chatCompletion({
      messages: [
        { role: 'system', content: 'You are an expert Vedic astrologer creating detailed professional reports. Use accurate Jyotish terminology and provide actionable insights. Return valid JSON.' },
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

    return this.getFallbackSections(type, name);
  }

  private getSectionTitles(type: string): string[] {
    const titles: Record<string, string[]> = {
      LIFE: ['Birth Chart Overview', 'Planetary Positions & Houses', 'Current Dasha Period Analysis', 'Key Yogas & Their Effects', 'Life Path & Destiny', 'Remedies & Recommendations'],
      CAREER: ['Professional Profile', 'Dashamsha (D10) Chart Analysis', 'Current Career Transit', 'Best Career Paths', 'Financial Outlook', 'Career Remedies & Timing'],
      MARRIAGE: ['Relationship Profile', 'Navamsa Chart Analysis', '7th House & Venus Analysis', 'Marriage Timing', 'Partner Compatibility Indicators', 'Relationship Remedies'],
      WEALTH: ['Financial Birth Chart Analysis', '2nd & 11th House Study', 'Dhana Yogas', 'Investment & Timing', 'Wealth Growth Periods', 'Financial Remedies'],
      PALM: ['Palm Lines Overview', 'Heart Line Analysis', 'Head Line Analysis', 'Life Line Analysis', 'Mount Analysis', 'Overall Reading & Guidance'],
      ANNUAL: ['Year Overview', 'Quarter 1 Forecast (Jan-Mar)', 'Quarter 2 Forecast (Apr-Jun)', 'Quarter 3 Forecast (Jul-Sep)', 'Quarter 4 Forecast (Oct-Dec)', 'Annual Remedies & Lucky Periods'],
    };
    return titles[type] || titles.LIFE;
  }

  private getFallbackSections(type: string, name: string) {
    return [
      { title: 'Overview', content: `${name}, your ${type.toLowerCase()} report has been generated based on Vedic astrological principles. The planetary positions at your time of birth reveal important insights about your life path.`, order: 1 },
      { title: 'Analysis', content: `The current planetary transits and Dasha periods indicate significant developments ahead. Jupiter and Saturn's influences suggest a period of growth and consolidation.`, order: 2 },
      { title: 'Recommendations', content: `To strengthen beneficial planetary influences, practice meditation, observe fasting on days ruled by your chart's key planets, and consider consulting an astrologer for personalized gemstone recommendations.`, order: 3 },
    ];
  }
}
