import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import {
  FeatureAccessService,
} from '../../common/feature-access/feature-access.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import { OpenAIService } from '../../openai/openai.service';
import { getLocaleInstruction } from '../../common/locale';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { StorageService } from '../../storage/storage.service';
import { PALMISTRY_QUEUE } from '../../queue/queue.constants';
import type { PalmistryJobData } from '../../queue/palmistry.processor';

export interface PalmistryAnalysis {
  id: string;
  userId: string;
  imageUrl?: string;
  status?: 'processing' | 'completed' | 'failed';
  atAGlance?: AtAGlance;
  handOverview?: HandOverview;
  handShape?: HandShape;
  lines: PalmLine[];
  mounts: PalmMount[];
  fingerAnalysis: FingerAnalysis[];
  specialMarkings: SpecialMarking[];
  timingInsights: TimingInsight[];
  overallReading: string;
  healthInsights: string;
  careerInsights: string;
  relationshipInsights: string;
  spiritualInsights: string;
  cautions: string;
  closingAffirmation?: string;
  createdAt: string;
}

export interface AtAGlance {
  strengths: string;
  lifePath: string;
  love: string;
  bestSuitedFor: string;
}

export interface HandOverview {
  handType: string;
  palmShape: string;
  fingers: string;
  thumb: string;
  dominantHand: string;
}

export interface PalmLine {
  name: string;
  subtitle?: string;
  description: string;
  observations?: string[];
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

export interface SpecialMarking {
  name: string;
  location: string;
  interpretation: string;
}

export interface TimingInsight {
  ageRange: string;
  area: string;
  description: string;
}

export interface HandShape {
  type: 'Earth' | 'Air' | 'Water' | 'Fire' | string;
  description: string;
}

/** How a palmistry reading is paid for under the active monetization mode. */
type PalmAccess =
  | { kind: 'subscriber' } // free for this generation — nothing to record
  | { kind: 'entitlement' } // legacy: consume one one-time PALMISTRY unlock
  | { kind: 'metered'; periodKey: string }; // subscription model: count it

@Injectable()
export class PalmistryService {
  private readonly logger = new Logger(PalmistryService.name);

  private readonly queueEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private featureAccess: FeatureAccessService,
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
    gender?: string,
  ): Promise<PalmistryAnalysis> {
    this.logger.log(`Analyzing palm for user: ${userId}`);

    const access = await this.resolvePalmAccess(userId);
    return this.runPalmistryAnalysis(userId, imageBuffer, imageMimeType, locale, gender, access);
  }

  /**
   * Decide how a palmistry reading is paid for. Legacy (credits on): the
   * existing pay-to-unlock model — subscriber (free), else an unused one-time
   * PALMISTRY entitlement (resolveUnlock throws 402 when neither applies). New
   * model (credits off): metered by reading count (free 2 lifetime / subscriber
   * 4 per month, + purchased overage), checked BEFORE the (costly) Vision call
   * — closing the previously-unbounded palmistry cost leak.
   */
  private async resolvePalmAccess(userId: string): Promise<PalmAccess> {
    if (await this.featureAccess.creditsEnabled()) {
      const mode = await this.featureAccess.resolveUnlock(userId, 'PALMISTRY');
      return { kind: mode };
    }
    if (await this.featureAccess.paidFeaturesFree()) return { kind: 'subscriber' };

    const usage = await this.featureAccess.checkUsage(userId, 'palmistry');
    if (!usage.allowed) {
      throw new PaymentRequiredException(
        usage.isSubscriber
          ? "You've used all your palmistry readings this month. Buy +2 readings to continue."
          : "You've used your free palmistry readings. Subscribe for more.",
        { subscribe: !usage.isSubscriber, feature: 'palmistry' },
      );
    }
    return { kind: 'metered', periodKey: usage.periodKey };
  }

  private async runPalmistryAnalysis(
    userId: string,
    imageBuffer: Buffer | undefined,
    imageMimeType: string | undefined,
    locale: string | undefined,
    gender: string | undefined,
    access: PalmAccess,
  ): Promise<PalmistryAnalysis> {
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

    // Async path: enqueue job for background processing.
    // If either the DB write or queue.add fails, fall through to the sync
    // path rather than 500ing — the user has already paid credits.
    if (this.queueEnabled) {
      // Only the create+enqueue is inside the fallback try. The entitlement
      // consume is done AFTER, outside the try — so a consume failure (e.g.
      // a concurrent 402 race) surfaces to the caller instead of silently
      // falling through to the sync path and burning a SECOND unlock.
      let reading: any = null;
      try {
        reading = await this.prisma.palmistryReading.create({
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
          creditCost: 0,
          imageKey: imageKey ?? undefined,
          imageMimeType,
          locale,
          gender,
          // Metered model: pass the counter so a failed job gives the reading
          // back (the unit is counted now, in recordPalmConsumption below).
          meteredFeature: access.kind === 'metered' ? 'palmistry' : undefined,
          meteredPeriodKey: access.kind === 'metered' ? access.periodKey : undefined,
        } satisfies PalmistryJobData);
      } catch (err) {
        this.logger.error(
          `Palmistry async enqueue failed (${(err as Error)?.message}); falling back to sync analysis`,
        );
        reading = null; // signal fall-through to the sync path below
      }

      if (reading) {
        // Enqueue succeeded — record consumption exactly once now that the
        // reading row exists (no-op for subscribers; consumes a one-time
        // entitlement in legacy mode, or counts a metered reading in the
        // subscription model). The processor restores it if analysis fails.
        await this.recordPalmConsumption(userId, access, reading.id);

        return {
          id: reading.id,
          userId,
          imageUrl,
          status: 'processing',
          lines: [],
          mounts: [],
          fingerAnalysis: [],
          specialMarkings: [],
          timingInsights: [],
          overallReading: 'Your palmistry reading is being processed. Check back shortly.',
          healthInsights: '',
          careerInsights: '',
          relationshipInsights: '',
          spiritualInsights: '',
          cautions: '',
          createdAt: reading.createdAt.toISOString(),
        };
      }
    }

    // Sync path (fallback when QUEUE_ENABLED=false)
    let analysisData: any;
    const client = this.openaiService.getClient();

    // KB context is best-effort: a DB hiccup must not break the reading.
    let palmKBSection = '';
    try {
      const palmKB = await this.knowledgeService.getByCategory('palmistry', 15);
      const palmKBContext = this.knowledgeService.assembleContext(palmKB);
      palmKBSection = palmKBContext ? `\n\nReference Knowledge:\n${palmKBContext}` : '';
    } catch (err) {
      this.logger.warn(`Palmistry KB lookup failed, continuing without it: ${(err as Error)?.message}`);
    }

    if (client && imageBuffer) {
      const visionModel = this.openaiService.getModelForFeature('vision');
      try {
        const base64Image = imageBuffer.toString('base64');
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
                { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${base64Image}`, detail: 'high' } },
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
          try {
            analysisData = JSON.parse(content);
          } catch (parseErr) {
            this.logger.error(
              `Palmistry: vision returned invalid JSON, using fallback: ${(parseErr as Error)?.message}`,
            );
          }
        }
      } catch (error) {
        this.logger.error('OpenAI Vision palm analysis failed, using fallback', error);
      }
    }

    if (!analysisData) {
      try {
        analysisData = await this.getKBEnrichedFallback();
      } catch (err) {
        this.logger.warn(`KB-enriched fallback failed, using static fallback: ${(err as Error)?.message}`);
        analysisData = getDefaultFallback();
      }
    }

    let readingId = '';
    let createdAt = new Date().toISOString();
    try {
      const reading = await this.prisma.palmistryReading.create({
        data: {
          userId,
          imageUrl,
          imageKey,
          analysisData,
        },
      });
      readingId = reading.id;
      createdAt = reading.createdAt.toISOString();
    } catch (err) {
      this.logger.error(
        `Palmistry DB write failed, returning analysis without persistence: ${(err as Error)?.message}`,
      );
    }

    // Consume the unlock separately and do NOT swallow its failure. Previously
    // this ran inside the persistence try/catch, so a consumption failure — e.g.
    // a concurrent request already claimed the only entitlement (402) — was
    // logged as "DB write failed" and the full reading was still returned for
    // free. If consumption fails, remove the persisted reading and surface the
    // error instead of delivering an unpaid reading.
    if (readingId) {
      try {
        await this.recordPalmConsumption(userId, access, readingId);
      } catch (err) {
        await this.prisma.palmistryReading.delete({ where: { id: readingId } }).catch(() => {});
        throw err;
      }
    }

    return {
      id: readingId,
      userId,
      imageUrl,
      ...analysisData,
      createdAt,
    };
  }

  /**
   * Record that one palmistry reading was consumed, bound to the generated
   * `ref` row. No-op for subscribers; consumes a one-time entitlement in
   * legacy mode; counts a metered reading in the subscription model.
   */
  private async recordPalmConsumption(userId: string, access: PalmAccess, ref: string): Promise<void> {
    if (access.kind === 'entitlement') {
      await this.featureAccess.consumeEntitlement(userId, 'PALMISTRY', ref);
    } else if (access.kind === 'metered') {
      await this.featureAccess.incrementUsage(userId, 'palmistry', access.periodKey);
    }
  }

  async getReadingStatus(
    userId: string,
    readingId: string,
  ): Promise<{ id: string; status: string; analysis?: PalmistryAnalysis }> {
    const reading = await this.prisma.palmistryReading.findFirst({
      where: { id: readingId, userId },
      select: { id: true, userId: true, imageUrl: true, analysisData: true, createdAt: true },
    });
    if (!reading) throw new BadRequestException('Reading not found');
    const data = reading.analysisData as any;

    if (data?.status === 'processing') {
      return { id: reading.id, status: 'processing' };
    }
    if (data?.status === 'failed') {
      return { id: reading.id, status: 'failed' };
    }

    return {
      id: reading.id,
      status: 'completed',
      analysis: {
        id: reading.id,
        userId: reading.userId,
        imageUrl: reading.imageUrl ?? undefined,
        status: 'completed',
        ...data,
        createdAt: reading.createdAt.toISOString(),
      },
    };
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
    return getDefaultFallback();
  }
}

export function buildPalmistrySystemPrompt(palmKBSection: string, locale?: string, gender?: string): string {
  const handHint =
    gender === 'male'
      ? "The user is male, so the right palm (active, dominant hand) is being analysed."
      : gender === 'female'
        ? "The user is female, so the left palm (passive, receptive hand) is being analysed."
        : "Note whether the image appears to show the left or right palm and treat accordingly.";

  return `You are an expert palmist trained in Hast Rekha Shastra (Vedic palmistry) with deep knowledge of Western palmistry as well. Produce a thorough, structured reading from the palm image. ${handHint}

Return a STRICT JSON object with these keys:
{
  "atAGlance": {
    "strengths": "3-5 comma-separated personality strengths (e.g. 'Resilient, analytical, independent, loyal')",
    "lifePath": "one short phrase capturing life direction (e.g. 'A path of growth, leadership, and purpose')",
    "love": "one short phrase about emotional style (e.g. 'Deep feelings, selective, sincere')",
    "bestSuitedFor": "one short phrase about ideal pursuits (e.g. 'Leadership, strategy, entrepreneurship')"
  },
  "handOverview": {
    "handType": "Fire | Air | Water | Earth (with a 2-3 word descriptor, e.g. 'Air — curious, communicative')",
    "palmShape": "short shape descriptor (e.g. 'Rectangular palm, long fingers')",
    "fingers": "short finger descriptor (e.g. 'Long fingers with rounded tips — thoughtful, detail-oriented')",
    "thumb": "short thumb descriptor (e.g. 'Strong & flexible — willpower with adaptability')",
    "dominantHand": "Likely Right | Likely Left (and one short reason if visible)"
  },
  "handShape": { "type": "Earth | Air | Water | Fire", "description": "1-2 sentences on what the overall hand shape says about temperament" },
  "lines": [
    { "name": "Heart Line | Head Line | Life Line | Fate Line | Sun Line | Mercury Line | Marriage Line | Bracelet Line | etc.",
      "subtitle": "2-4 word life area, e.g. 'Emotion & Relationships', 'Mind & Intellect', 'Energy & Vitality', 'Career & Direction', 'Success & Recognition'",
      "description": "where it starts, curves, ends; clarity, depth, breaks, chains, islands",
      "observations": ["2-4 short bullets capturing what is visible (e.g. 'Deep and clear', 'Curves toward Jupiter', 'No major breaks')"],
      "strength": "strong | moderate | weak",
      "interpretation": "2-3 sentence interpretation tying observation to life meaning" }
  ],
  "mounts": [
    { "name": "Mount of Jupiter | Saturn | Apollo | Mercury | Venus | Moon (Luna) | Mars (Upper/Lower)",
      "prominence": "elevated | normal | flat",
      "interpretation": "what its development indicates" }
  ],
  "fingerAnalysis": [
    { "finger": "Thumb | Index (Jupiter) | Middle (Saturn) | Ring (Apollo) | Little (Mercury)",
      "length": "long | average | short",
      "interpretation": "personality and aptitude implications" }
  ],
  "specialMarkings": [
    { "name": "Star | Cross | Triangle | Square | Island | Chain | Grille | Trident | Fish",
      "location": "where on the palm (e.g. on the Fate Line near the head line)",
      "interpretation": "what it traditionally signifies" }
  ],
  "timingInsights": [
    { "ageRange": "0-20 | 20-35 | 35-50 | 50+ years",
      "area": "career | relationships | health | spirituality",
      "description": "what the lines suggest is significant in this period" }
  ],
  "overallReading": "4-6 sentence holistic synthesis of the personality and life themes",
  "healthInsights": "3-4 sentences on vitality, stress markers, areas to watch",
  "careerInsights": "3-4 sentences on aptitudes, leadership, ideal directions",
  "relationshipInsights": "3-4 sentences on emotional patterns, marriage line indications, partner qualities",
  "spiritualInsights": "2-3 sentences on dharma, intuition, growth path",
  "cautions": "2-3 gentle, encouraging cautions framed as tendencies, not predictions",
  "closingAffirmation": "one short, uplifting closing line that speaks to the user's potential (e.g. 'You hold the power to shape your destiny' or 'Your path is yours to build with intention.')"
}

Rules:
- Always include ALL major lines (Heart, Head, Life, Fate, Sun) in the lines array — mark a missing/very faint line as "weak" and explain.
- Aim for 5-7 entries in lines (include any visible minor lines you see).
- Aim for 4-6 entries in mounts and 3-5 in fingerAnalysis.
- specialMarkings can be empty if none visible; otherwise include at least 2.
- timingInsights should have 3-4 entries spanning life stages.
- Each major line MUST include a "subtitle" (life area) and "observations" (2-4 short visual bullets) so the reading reads like an editorial guide, not a wall of text.
- Speak with warmth and respect. Frame difficulties as "tendencies", never as fate.
- Never claim to predict death, exact dates, or medical diagnoses.${palmKBSection}${getLocaleInstruction(locale)}`;
}

export function buildPalmistryUserPrompt(gender?: string): string {
  const which =
    gender === 'male'
      ? 'right palm'
      : gender === 'female'
        ? 'left palm'
        : 'palm';
  return `Please analyse this ${which} image carefully and return the full structured palmistry reading as specified. Be specific about what you observe — line clarity, branching, mount development, finger proportions and any markings. If the image is blurry or only shows part of the palm, still produce the best possible reading from what is visible and note any limitations in the overallReading field.`;
}

export function getDefaultFallback() {
  return {
    atAGlance: {
      strengths: 'Resilient, analytical, independent, loyal',
      lifePath: 'A path of growth, leadership, and purpose',
      love: 'Deep feelings, selective, sincere',
      bestSuitedFor: 'Leadership, strategy, entrepreneurship',
    },
    handOverview: {
      handType: 'Air — curious, communicative, quick thinker',
      palmShape: 'Rectangular palm, long fingers',
      fingers: 'Long fingers with rounded tips — thoughtful and detail-oriented',
      thumb: 'Strong & flexible — willpower paired with adaptability',
      dominantHand: 'Likely right — externally driven, action-oriented',
    },
    handShape: {
      type: 'Air',
      description: 'A balanced palm with proportional fingers — suggesting a thoughtful, communicative temperament that is comfortable with ideas and people.',
    },
    lines: [
      {
        name: 'Heart Line',
        subtitle: 'Emotion & Relationships',
        description: 'Starts below the index finger and curves gently toward the middle finger, clear and unbroken.',
        observations: ['Deep and clear', 'Ends between index and middle fingers', 'Gentle upward curve'],
        strength: 'strong',
        interpretation: 'Deep capacity for love and emotional expression. Loyal, warm, and willing to invest in long relationships.',
      },
      {
        name: 'Head Line',
        subtitle: 'Mind & Intellect',
        description: 'Runs straight across the palm with a soft downward slope at the end.',
        observations: ['Long and well-defined', 'Slightly slopes downward', 'Good separation from life line at the start'],
        strength: 'strong',
        interpretation: 'Sharp analytical mind balanced with creative imagination. Practical decisions guided by intuition.',
      },
      {
        name: 'Life Line',
        subtitle: 'Energy & Vitality',
        description: 'Wide arc around the thumb, deep and well-defined.',
        observations: ['Deep and wide arc', 'Clear and unbroken', 'Strong start near thumb and index'],
        strength: 'strong',
        interpretation: 'Strong vitality and zest for life. Good physical stamina and recovery throughout life.',
      },
      {
        name: 'Fate Line',
        subtitle: 'Career & Direction',
        description: 'Visible line rising from the base of the palm toward the middle finger with a few small branches.',
        observations: ['Faint but present', 'Rises from lower palm', 'Strengthens upward'],
        strength: 'moderate',
        interpretation: 'Self-made path shaped by your own choices. Career grows stronger and clearer over time.',
      },
      {
        name: 'Sun Line',
        subtitle: 'Success & Recognition',
        description: 'Fine line parallel to the fate line, faint near the base, clearer toward the ring finger.',
        observations: ['Light but visible', 'Toward the ring finger', 'Develops in upper palm'],
        strength: 'weak',
        interpretation: 'Creative talents that benefit from conscious cultivation. Recognition tends to arrive later in life.',
      },
      {
        name: 'Mercury Line',
        subtitle: 'Communication & Health',
        description: 'Short, slightly broken line running toward the little finger.',
        observations: ['Short and partly broken', 'Runs toward Mercury (little finger)'],
        strength: 'moderate',
        interpretation: 'Communicates well and persuasively. Pay attention to digestion and stress management.',
      },
      {
        name: 'Marriage Line',
        subtitle: 'Partnership',
        description: 'One clear horizontal line on the edge of the palm beneath the little finger.',
        observations: ['One clear, long line', 'Edge of palm beneath Mercury'],
        strength: 'moderate',
        interpretation: 'Indicates one significant, lasting partnership built on mutual respect.',
      },
    ],
    mounts: [
      { name: 'Mount of Jupiter', prominence: 'elevated', interpretation: 'Leadership and ambition. A natural ability to inspire and guide others.' },
      { name: 'Mount of Saturn', prominence: 'normal', interpretation: 'Balanced sense of duty and discipline. Patient and reliable under pressure.' },
      { name: 'Mount of Apollo', prominence: 'elevated', interpretation: 'Artistic sensitivity and appreciation for beauty. Public recognition is possible.' },
      { name: 'Mount of Mercury', prominence: 'normal', interpretation: 'Quick wit, business acumen and clear self-expression.' },
      { name: 'Mount of Venus', prominence: 'elevated', interpretation: 'Warm, passionate nature with a strong capacity for love and friendship.' },
      { name: 'Mount of Moon', prominence: 'normal', interpretation: 'Healthy imagination and intuition. Comfortable with travel and new environments.' },
    ],
    fingerAnalysis: [
      { finger: 'Thumb', length: 'long', interpretation: 'Strong willpower and determination; can carry projects through to completion.' },
      { finger: 'Index (Jupiter)', length: 'average', interpretation: 'Balanced confidence — leads when needed without ego.' },
      { finger: 'Middle (Saturn)', length: 'long', interpretation: 'Serious, responsible and self-disciplined; values structure.' },
      { finger: 'Ring (Apollo)', length: 'average', interpretation: 'Balanced creative expression; enjoys art and aesthetics.' },
      { finger: 'Little (Mercury)', length: 'average', interpretation: 'Good communication abilities; persuasive in conversation.' },
    ],
    specialMarkings: [
      { name: 'Triangle', location: 'On the Fate Line near the head line', interpretation: 'Suggests a moment of clear strategic insight that benefits the career.' },
      { name: 'Star', location: 'On the Mount of Jupiter', interpretation: 'A traditional sign of recognition and elevation through merit.' },
    ],
    timingInsights: [
      { ageRange: '0-20 years', area: 'foundation', description: 'Formative learning and family influence; the early life line is clear and protected.' },
      { ageRange: '20-35 years', area: 'career', description: 'A significant new direction begins as the fate line strengthens — a self-chosen path.' },
      { ageRange: '35-50 years', area: 'relationships', description: 'Stabilising long-term partnerships and reaping the rewards of earlier work.' },
      { ageRange: '50+ years', area: 'spirituality', description: 'Increasing inward focus, mentoring others and creative legacy.' },
    ],
    overallReading: 'Your palm reveals a person of strong character with excellent analytical abilities and deep emotional intelligence. The prominent heart line and mount of Venus suggest a passionate nature, while the steady head line indicates practical wisdom. The hand as a whole shows balance — neither purely emotional nor purely intellectual, but able to draw on both as the moment requires.',
    healthInsights: 'The deep life line indicates robust health and physical vitality. The mercury line suggests sensitivity in the digestive and nervous systems — gentle daily routines, hydration and stress management will protect long-term wellbeing. Active rest (walking, yoga, breathwork) will serve you better than purely sedentary recovery.',
    careerInsights: 'The fate line suggests a career built through persistent effort rather than sudden luck. Leadership abilities shown by the mount of Jupiter indicate strong potential for managerial, advisory or entrepreneurial roles. The ring finger and Apollo mount add a creative dimension — work that combines structure with self-expression will feel most fulfilling.',
    relationshipInsights: 'The heart line indicates deep, meaningful relationships and a willingness to commit. You value loyalty and emotional honesty. Your ideal partner appreciates both intellectual companionship and emotional depth and gives you space to grow without losing closeness.',
    spiritualInsights: 'A clear head-life line junction indicates thoughtful, considered choices on the spiritual path. You are likely drawn to traditions that combine philosophical understanding with daily practice; service-oriented dharma resonates well.',
    cautions: 'Avoid carrying responsibility for outcomes that are not yours to control — the strong Saturn finger can over-shoulder. Watch for periods of overthinking around the mid-thirties; ground decisions in conversation with trusted people, not only inside your own head.',
    closingAffirmation: 'You hold the power to shape your destiny. The lines show potential — your choices write the story.',
  };
}
