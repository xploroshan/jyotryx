import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';
import { getLocaleInstruction } from '../../common/locale';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { StorageService } from '../../storage/storage.service';
import { PALMISTRY_QUEUE } from '../../queue/queue.module';
import type { PalmistryJobData } from '../../queue/palmistry.processor';

export interface PalmistryAnalysis {
  id: string;
  userId: string;
  imageUrl?: string;
  lines: PalmLine[];
  mounts: PalmMount[];
  fingerAnalysis: FingerAnalysis[];
  overallReading: string;
  healthInsights: string;
  careerInsights: string;
  relationshipInsights: string;
  createdAt: string;
}

export interface PalmLine {
  name: string;
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
  interpretation: string;
}

export interface PalmMount {
  name: string;
  prominence: 'elevated' | 'normal' | 'flat';
  interpretation: string;
}

export interface FingerAnalysis {
  finger: string;
  length: 'long' | 'average' | 'short';
  interpretation: string;
}

@Injectable()
export class PalmistryService {
  private readonly logger = new Logger(PalmistryService.name);

  private readonly queueEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private openaiService: OpenAIService,
    private knowledgeService: KnowledgeService,
    private storageService: StorageService,
    @Optional() @InjectQueue(PALMISTRY_QUEUE) private palmistryQueue?: Queue<PalmistryJobData>,
  ) {
    this.queueEnabled = this.configService.get<string>('QUEUE_ENABLED', 'false') === 'true' && !!this.palmistryQueue;
  }

  async analyzePalm(
    userId: string,
    imageBuffer?: Buffer,
    imageMimeType?: string,
    locale?: string,
  ): Promise<PalmistryAnalysis> {
    this.logger.log(`Analyzing palm for user: ${userId}`);

    const creditCost = this.configService.get<number>('credits.palmistryCost', 3);
    const deducted = await this.userService.deductCredits(userId, creditCost, 'Palmistry reading');
    if (!deducted) {
      throw new BadRequestException('Insufficient credits for palmistry reading.');
    }

    // Upload image to R2 first (needed by both sync and async paths)
    let imageKey: string | null = null;
    let imageUrl = '';
    if (imageBuffer && this.storageService.isAvailable()) {
      const ext = (imageMimeType || 'image/jpeg').split('/')[1] || 'jpeg';
      imageKey = `palmistry/${userId}/${Date.now()}.${ext}`;
      try {
        await this.storageService.uploadBuffer(imageKey, imageBuffer, imageMimeType || 'image/jpeg');
        imageUrl = await this.storageService.getPresignedDownloadUrl(imageKey);
      } catch (err) {
        this.logger.error('R2 upload failed, storing without image', err);
        imageKey = null;
      }
    }

    // Async path: enqueue job for background processing
    if (this.queueEnabled) {
      const reading = await this.prisma.palmistryReading.create({
        data: {
          userId,
          imageUrl,
          imageKey,
          analysisData: { status: 'processing' },
        },
      });

      await this.palmistryQueue!.add('analyze', {
        readingId: reading.id,
        userId,
        creditCost,
        imageKey: imageKey ?? undefined,
        imageMimeType,
        locale,
      } satisfies PalmistryJobData);

      return {
        id: reading.id,
        userId,
        imageUrl,
        lines: [],
        mounts: [],
        fingerAnalysis: [],
        overallReading: 'Your palmistry reading is being processed. Check back shortly.',
        healthInsights: '',
        careerInsights: '',
        relationshipInsights: '',
        createdAt: reading.createdAt.toISOString(),
      };
    }

    // Sync path (fallback when QUEUE_ENABLED=false)
    let analysisData: any;
    const client = this.openaiService.getClient();

    const palmKB = await this.knowledgeService.getByCategory('palmistry', 15);
    const palmKBContext = this.knowledgeService.assembleContext(palmKB);
    const palmKBSection = palmKBContext ? `\n\nReference Knowledge:\n${palmKBContext}` : '';

    if (client && imageBuffer) {
      const visionModel = this.openaiService.getModelForFeature('vision');
      try {
        const base64Image = imageBuffer.toString('base64');
        const completion = await client.chat.completions.create({
          model: visionModel,
          messages: [
            {
              role: 'system',
              content: `You are an expert palmist. Analyze the palm image and provide a detailed reading. Return a JSON object with keys: lines (array with name, description, strength, interpretation), mounts (array with name, prominence, interpretation), fingerAnalysis (array with finger, length, interpretation), overallReading (string), healthInsights (string), careerInsights (string), relationshipInsights (string).${palmKBSection}${getLocaleInstruction(locale)}`,
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Please analyze this palm image and provide a detailed palmistry reading.' },
                { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${base64Image}` } },
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
        this.logger.error('OpenAI Vision palm analysis failed, using fallback', error);
      }
    }

    if (!analysisData) {
      analysisData = await this.getKBEnrichedFallback();
    }

    const reading = await this.prisma.palmistryReading.create({
      data: {
        userId,
        imageUrl,
        imageKey,
        analysisData,
      },
    });

    return {
      id: reading.id,
      userId,
      imageUrl,
      ...analysisData,
      createdAt: reading.createdAt.toISOString(),
    };
  }

  async getReadingStatus(userId: string, readingId: string): Promise<{ id: string; status: string }> {
    const reading = await this.prisma.palmistryReading.findFirst({
      where: { id: readingId, userId },
      select: { id: true, analysisData: true },
    });
    if (!reading) throw new BadRequestException('Reading not found');
    const data = reading.analysisData as any;
    const status = data?.status === 'processing' ? 'processing' : 'completed';
    return { id: reading.id, status };
  }

  async getImageUrl(userId: string, readingId: string): Promise<{ url: string }> {
    const reading = await this.prisma.palmistryReading.findFirst({
      where: { id: readingId, userId },
      select: { imageKey: true, imageUrl: true },
    });

    if (!reading) {
      throw new BadRequestException('Reading not found');
    }

    // Prefer R2 presigned URL; fall back to legacy imageUrl
    if (reading.imageKey && this.storageService.isAvailable()) {
      const url = await this.storageService.getPresignedDownloadUrl(reading.imageKey);
      return { url };
    }

    if (reading.imageUrl) {
      return { url: reading.imageUrl };
    }

    throw new BadRequestException('No image available for this reading');
  }

  private async getKBEnrichedFallback() {
    const fallback = this.getFallbackAnalysis();

    // Enrich fallback with KB data for more detailed interpretations
    const [linesKB, mountsKB, fingersKB] = await Promise.all([
      this.knowledgeService.search('palm lines heart head life fate', 'palmistry', 3),
      this.knowledgeService.search('mounts jupiter venus apollo', 'palmistry', 2),
      this.knowledgeService.search('fingers thumb hand shape', 'palmistry', 2),
    ]);

    if (linesKB.length > 0) {
      fallback.overallReading += '\n\n' + linesKB.map((r) => r.text).join(' ').substring(0, 300);
    }
    if (mountsKB.length > 0) {
      fallback.careerInsights += ' ' + mountsKB[0].text.substring(0, 150);
    }

    return fallback;
  }

  private getFallbackAnalysis() {
    return {
      lines: [
        { name: 'Heart Line', description: 'Starts below the index finger and curves toward the middle finger', strength: 'strong', interpretation: 'Deep capacity for love and emotional expression. Relationships characterized by loyalty and warmth.' },
        { name: 'Head Line', description: 'Runs straight across the palm with a slight curve at the end', strength: 'strong', interpretation: 'Sharp analytical mind with practical thinking and creative solutions.' },
        { name: 'Life Line', description: 'Wide arc around the thumb, deep and clear', strength: 'strong', interpretation: 'Strong vitality and zest for life. Good health and physical stamina throughout life.' },
        { name: 'Fate Line', description: 'Clear line running from base of palm toward middle finger', strength: 'moderate', interpretation: 'Career path shows steady progression with key turning points. Self-made success.' },
        { name: 'Sun Line', description: 'Faint line running parallel to the fate line', strength: 'weak', interpretation: 'Creative talents that need conscious development. Public recognition may come later.' },
      ],
      mounts: [
        { name: 'Mount of Jupiter', prominence: 'elevated', interpretation: 'Leadership qualities and ambition. Natural ability to inspire others.' },
        { name: 'Mount of Saturn', prominence: 'normal', interpretation: 'Balanced approach to responsibilities and discipline.' },
        { name: 'Mount of Apollo', prominence: 'elevated', interpretation: 'Artistic talent and appreciation for beauty.' },
        { name: 'Mount of Venus', prominence: 'elevated', interpretation: 'Passionate nature. Strong capacity for love and affection.' },
      ],
      fingerAnalysis: [
        { finger: 'Thumb', length: 'long', interpretation: 'Strong willpower and determination' },
        { finger: 'Index (Jupiter)', length: 'average', interpretation: 'Balanced leadership and confidence' },
        { finger: 'Middle (Saturn)', length: 'long', interpretation: 'Serious and responsible nature' },
        { finger: 'Ring (Apollo)', length: 'average', interpretation: 'Balanced creative expression' },
        { finger: 'Little (Mercury)', length: 'average', interpretation: 'Good communication abilities' },
      ],
      overallReading: 'Your palm reveals a person of strong character with excellent analytical abilities and deep emotional intelligence. The prominent heart line and mount of Venus suggest a passionate nature, while the strong head line indicates practical wisdom.',
      healthInsights: 'The deep life line indicates robust health and physical vitality. Pay attention to stress management as the head line suggests an active mind that benefits from meditation.',
      careerInsights: 'The fate line suggests a career built through persistent effort. Leadership abilities shown by the mount of Jupiter indicate potential for managerial or entrepreneurial roles.',
      relationshipInsights: 'The heart line indicates deep, meaningful relationships. You value loyalty and emotional connection. Your ideal partner appreciates both intellectual stimulation and emotional depth.',
    };
  }
}
