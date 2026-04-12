import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { UserService } from '../modules/user/user.service';
import { StorageService } from '../storage/storage.service';
import { PALMISTRY_QUEUE } from './queue.module';

export interface PalmistryJobData {
  readingId: string;
  userId: string;
  creditCost: number;
  imageKey?: string;
  imageMimeType?: string;
  locale?: string;
}

@Processor(PALMISTRY_QUEUE)
export class PalmistryProcessor extends WorkerHost {
  private readonly logger = new Logger(PalmistryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
    private readonly userService: UserService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<PalmistryJobData>): Promise<void> {
    const { readingId, userId, creditCost, imageKey, imageMimeType, locale } = job.data;
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
                content: `You are an expert palmist. Analyze the palm image and provide a detailed reading. Return a JSON object with keys: lines (array with name, description, strength, interpretation), mounts (array with name, prominence, interpretation), fingerAnalysis (array with finger, length, interpretation), overallReading (string), healthInsights (string), careerInsights (string), relationshipInsights (string).${palmKBSection}`,
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Please analyze this palm image and provide a detailed palmistry reading.' },
                  { type: 'image_url', image_url: { url: presignedUrl } },
                ],
              },
            ],
            max_tokens: 1500,
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
        analysisData = this.getFallbackAnalysis();
      }

      // Update the reading with analysis results
      await this.prisma.palmistryReading.update({
        where: { id: readingId },
        data: { analysisData },
      });

      this.logger.log(`Palmistry reading ${readingId} completed successfully`);
    } catch (error) {
      this.logger.error(`Palmistry ${readingId} failed: ${(error as Error).message}`);

      // Refund credits on final attempt
      if (job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        this.logger.log(`Refunding ${creditCost} credits for failed palmistry ${readingId}`);
        await this.userService.addCredits(userId, creditCost, 'PURCHASE', 'Refund: Palmistry analysis failed');
      }

      throw error;
    }
  }

  private getFallbackAnalysis() {
    return {
      lines: [
        { name: 'Heart Line', description: 'Starts below the index finger and curves toward the middle finger', strength: 'strong', interpretation: 'Deep capacity for love and emotional expression.' },
        { name: 'Head Line', description: 'Runs straight across the palm with a slight curve at the end', strength: 'strong', interpretation: 'Sharp analytical mind with practical thinking.' },
        { name: 'Life Line', description: 'Wide arc around the thumb, deep and clear', strength: 'strong', interpretation: 'Strong vitality and zest for life.' },
      ],
      mounts: [
        { name: 'Mount of Jupiter', prominence: 'elevated', interpretation: 'Leadership qualities and ambition.' },
        { name: 'Mount of Venus', prominence: 'elevated', interpretation: 'Passionate nature and strong capacity for love.' },
      ],
      fingerAnalysis: [
        { finger: 'Thumb', length: 'long', interpretation: 'Strong willpower and determination' },
        { finger: 'Index (Jupiter)', length: 'average', interpretation: 'Balanced leadership and confidence' },
      ],
      overallReading: 'Your palm reveals strong character with excellent analytical abilities and deep emotional intelligence.',
      healthInsights: 'The deep life line indicates robust health and physical vitality.',
      careerInsights: 'The fate line suggests a career built through persistent effort with leadership potential.',
      relationshipInsights: 'The heart line indicates deep, meaningful relationships built on loyalty.',
    };
  }
}
