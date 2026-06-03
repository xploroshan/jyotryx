import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { UserService } from '../modules/user/user.service';
import { FeatureAccessService } from '../common/feature-access/feature-access.service';
import { StorageService } from '../storage/storage.service';
import { PALMISTRY_QUEUE } from './queue.constants';
import {
  buildPalmistrySystemPrompt,
  buildPalmistryUserPrompt,
  getDefaultFallback,
} from '../modules/palmistry/palmistry.service';

export interface PalmistryJobData {
  readingId: string;
  userId: string;
  creditCost: number;
  imageKey?: string;
  imageMimeType?: string;
  locale?: string;
  gender?: string;
}

@Processor(PALMISTRY_QUEUE)
export class PalmistryProcessor extends WorkerHost {
  private readonly logger = new Logger(PalmistryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
    private readonly userService: UserService,
    private readonly featureAccess: FeatureAccessService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<PalmistryJobData>): Promise<void> {
    const { readingId, userId, creditCost, imageKey, imageMimeType: _imageMimeType, locale, gender } = job.data;
    this.logger.log(`Processing palmistry job ${job.id} — readingId=${readingId}`);

    try {
      let analysisData: any;
      const client = this.openaiService.getClient();

      // Fetch palmistry KB context
      const palmKB = await this.knowledgeService.getByCategory('palmistry', 15);
      const palmKBContext = this.knowledgeService.assembleContext(palmKB);
      const palmKBSection = palmKBContext ? `\n\nReference Knowledge:\n${palmKBContext}` : '';

      // If we have an image stored in R2, download it for Vision API
      if (client && imageKey && this.storageService.isAvailable()) {
        const visionModel = this.openaiService.getModelForFeature('vision');
        try {
          const presignedUrl = await this.storageService.getPresignedDownloadUrl(imageKey);
          const completion = await client.chat.completions.create({
            model: visionModel,
            messages: [
              {
                role: 'system',
                content: buildPalmistrySystemPrompt(palmKBSection, locale, gender),
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: buildPalmistryUserPrompt(gender) },
                  { type: 'image_url', image_url: { url: presignedUrl, detail: 'high' } },
                ],
              },
            ],
            max_tokens: 3500,
            response_format: { type: 'json_object' },
          });

          this.openaiService.recordUsage?.({
            userId,
            feature: 'palmistry',
            model: visionModel,
            usage: completion?.usage,
          });

          const content = completion.choices[0]?.message?.content;
          if (content) {
            analysisData = JSON.parse(content);
          }
        } catch (error) {
          this.logger.error('Vision API palm analysis failed in queue', error);
        }
      }

      if (!analysisData) {
        analysisData = getDefaultFallback();
      }

      // Update the reading with analysis results
      await this.prisma.palmistryReading.update({
        where: { id: readingId },
        data: { analysisData },
      });

      this.logger.log(`Palmistry reading ${readingId} completed successfully`);
    } catch (error) {
      this.logger.error(`Palmistry ${readingId} failed: ${(error as Error).message}`);

      // Refund on final attempt. Palmistry is pay-to-unlock, so restore the
      // one-time entitlement bound to this reading (no-op for subscriber/
      // free readings). Legacy credit-charged jobs still get credits back.
      if (job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        await this.featureAccess.refundEntitlementByRef(readingId);
        if (creditCost > 0) {
          this.logger.log(`Refunding ${creditCost} credits for failed palmistry ${readingId}`);
          await this.userService.addCredits(userId, creditCost, 'PURCHASE', 'Refund: Palmistry analysis failed');
        }
        // Mark the reading as failed so the client polling stops with a clear status
        try {
          await this.prisma.palmistryReading.update({
            where: { id: readingId },
            data: { analysisData: { status: 'failed', message: 'Analysis failed. Your purchase has been restored.' } },
          });
        } catch (updateErr) {
          this.logger.error('Failed to mark reading as failed', updateErr as Error);
        }
      }

      throw error;
    }
  }
}
