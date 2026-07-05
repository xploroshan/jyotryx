import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { LlmService } from '../llm/llm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KbService, KbReportSectionPayload } from '../knowledge/kb.service';
import { UserService } from '../modules/user/user.service';
import { FeatureAccessService } from '../common/feature-access/feature-access.service';
import { getLocaleInstruction } from '../common/locale';
import { REPORT_QUEUE } from './queue.constants';

export interface ReportJobData {
  reportId: string;
  userId: string;
  type: string;
  creditCost: number;
  birthDetails: { dateOfBirth: string; timeOfBirth: string; placeOfBirth: string };
  name: string;
  gender?: string | null;
  batchId?: string;
  locale?: string;
  /** Subscription-model meter to give back if the job fails after counting. */
  meteredFeature?: string;
  meteredPeriodKey?: string;
}

@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly llmService: LlmService,
    private readonly knowledgeService: KnowledgeService,
    private readonly kbService: KbService,
    private readonly userService: UserService,
    private readonly featureAccess: FeatureAccessService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportId, userId, type, creditCost, birthDetails, name, gender, locale, meteredFeature, meteredPeriodKey } = job.data;
    this.logger.log(`Processing report job ${job.id} — reportId=${reportId} type=${type}`);

    try {
      const sections = await this.generateSections(type, birthDetails, name, gender, userId, locale);

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

      // Only act on the FINAL attempt. BullMQ retries after backoff, so flipping
      // the row to FAILED (or refunding) mid-retry makes clients that treat
      // FAILED as terminal abort on a report that later succeeds — and would
      // double-refund across attempts.
      if (job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        await this.prisma.report.update({
          where: { id: reportId },
          data: { status: 'FAILED' },
        }).catch(() => {});

        // Reports are pay-to-unlock, so restore the one-time entitlement bound
        // to this report (no-op for subscriber/free generations). Legacy
        // credit-charged jobs (creditCost > 0) still get a credit refund.
        await this.featureAccess.refundEntitlementByRef(reportId);
        // Subscription model: give back the metered report counted at enqueue.
        if (meteredFeature && meteredPeriodKey) {
          await this.featureAccess.decrementUsage(userId, meteredFeature, meteredPeriodKey);
        }
        if (creditCost > 0) {
          this.logger.log(`Refunding ${creditCost} credits for failed report ${reportId}`);
          await this.userService.addCredits(userId, creditCost, 'PURCHASE', `Refund: ${type} report generation failed`);
        }
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
    locale?: string,
  ) {
    if (!birthDetails.dateOfBirth) {
      return this.loadFallbackSections(type, name, locale);
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

    const systemPrompt = 'You are an expert Vedic astrologer creating detailed professional reports. Use accurate Jyotish terminology and provide actionable insights. Return valid JSON.' +
      getLocaleInstruction(locale);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    // NOTE: the OpenAI Batch API (24h SLA) was previously submitted here and
    // polled in-process for up to 10 minutes. That pinned a BullMQ worker slot
    // for the whole window (starving the report queue under load), almost
    // always timed out into the sync path anyway, and — because the job retries
    // — re-submitted a brand-new batch each attempt (double cost). Reports now
    // go straight to synchronous completion. A real async batch pipeline, if
    // ever wanted, must persist the batchId on the Report row and be collected
    // by a separate scheduled reaper rather than polled inline.

    // Synchronous completion via LlmService (with full failover chain)
    const result = await this.openaiService.chatCompletion({
      messages,
      maxTokens: 2000,
      temperature: 0.7,
      jsonMode: true,
      userId,
      feature: `report:${type.toLowerCase()}`,
    });

    if (result?.sections && Array.isArray(result.sections) && result.sections.length > 0) {
      return result.sections;
    }

    // The provider returned null / empty sections (the most common failure mode
    // — it does NOT throw). Do NOT silently store the generic canned fallback as
    // a READY *paid* report: throw so the job retries and, on the final attempt,
    // the catch block refunds the unlock and marks the report FAILED. (The
    // no-birth-data path above still returns the fallback intentionally.)
    throw new Error(`Report generation returned no usable sections for ${type}`);
  }

  /**
   * Render the 6-section fallback in the user's locale from
   * KbReportSection. Falls back to English titles + a stub content when
   * the KB cache is cold. Both the service's sync path and this queue
   * processor's async path go through the same KB rows, so users get a
   * consistent fallback regardless of which path generated the report.
   */
  private async loadFallbackSections(
    type: string,
    name: string,
    locale?: string,
  ): Promise<{ title: string; content: string; order: number }[]> {
    const titles = this.getSectionTitles(type);
    const rows = await Promise.all(
      titles.map((_, i) => this.kbService.getReportSection(type, i + 1)),
    );
    return titles.map((fallbackTitle, i) => {
      const payload: KbReportSectionPayload | null = this.kbService.render(rows[i], locale);
      const title = payload?.title ?? fallbackTitle;
      const content = (payload?.content
        ?? `${name}, your ${type.toLowerCase()} report has been generated based on Vedic astrological principles.`
      ).replace(/\{name\}/g, name);
      return { title, content, order: i + 1 };
    });
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
}
