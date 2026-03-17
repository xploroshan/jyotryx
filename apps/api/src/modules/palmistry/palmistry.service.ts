import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';

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

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private openaiService: OpenAIService,
  ) {}

  async analyzePalm(
    userId: string,
    imageBuffer?: Buffer,
    imageMimeType?: string,
  ): Promise<PalmistryAnalysis> {
    this.logger.log(`Analyzing palm for user: ${userId}`);

    const creditCost = this.configService.get<number>('credits.palmistryCost', 3);
    const deducted = await this.userService.deductCredits(userId, creditCost, 'Palmistry reading');
    if (!deducted) {
      throw new BadRequestException('Insufficient credits for palmistry reading.');
    }

    let analysisData: any;
    const client = this.openaiService.getClient();

    if (client && imageBuffer) {
      try {
        const base64Image = imageBuffer.toString('base64');
        const completion = await client.chat.completions.create({
          model: this.openaiService.getModel(),
          messages: [
            {
              role: 'system',
              content: 'You are an expert palmist. Analyze the palm image and provide a detailed reading. Return a JSON object with keys: lines (array with name, description, strength, interpretation), mounts (array with name, prominence, interpretation), fingerAnalysis (array with finger, length, interpretation), overallReading (string), healthInsights (string), careerInsights (string), relationshipInsights (string).',
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

        const content = completion.choices[0]?.message?.content;
        if (content) {
          analysisData = JSON.parse(content);
        }
      } catch (error) {
        this.logger.error('OpenAI Vision palm analysis failed, using fallback', error);
      }
    }

    if (!analysisData) {
      analysisData = this.getFallbackAnalysis();
    }

    // Save to database
    const reading = await this.prisma.palmistryReading.create({
      data: {
        userId,
        imageUrl: imageBuffer ? 'uploaded' : '',
        analysisData,
      },
    });

    return {
      id: reading.id,
      userId,
      ...analysisData,
      createdAt: reading.createdAt.toISOString(),
    };
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
