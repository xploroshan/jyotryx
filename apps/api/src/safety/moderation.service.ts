import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';

/**
 * Non-blocking content moderation dispatch. Wraps OpenAI's moderation
 * endpoint — cheap (free tier), no token consumption, returns
 * per-category scores + a single `flagged` boolean. Only flagged
 * inputs write a row to `flagged_messages`; safe inputs leave no
 * trace, so the table stays small and the Safety tab's pagination
 * holds up.
 */
export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
  ) {}

  /**
   * Fire-and-forget: inspect `content` via OpenAI moderation, and if
   * flagged, insert a `flagged_messages` row. Swallows all errors —
   * the chat write path must never fail because moderation failed.
   * Intended to be called with `.catch(() => {})` discipline, or
   * simply not awaited.
   */
  async checkAndRecord(params: {
    messageId: string;
    userId: string;
    content: string;
  }): Promise<ModerationResult | null> {
    const client = this.openaiService.getClient();
    if (!client || typeof (client as any).moderations?.create !== 'function') {
      // No OpenAI client wired — silently skip. Dev envs without a key
      // should not fail chat writes.
      return null;
    }

    let result: ModerationResult | null = null;
    try {
      // The OpenAI moderation API returns { results: [ { flagged, categories, category_scores } ] }.
      // We normalise it to a simpler shape that matches what Prisma persists.
      const response: any = await (client as any).moderations.create({ input: params.content });
      const hit = response?.results?.[0];
      if (!hit) return null;

      const categories: string[] = Object.entries(hit.categories ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k);

      result = {
        flagged: !!hit.flagged,
        categories,
        scores: (hit.category_scores ?? {}) as Record<string, number>,
      };
    } catch (err: any) {
      // Rate limit, network error, invalid key, etc. We log and move on —
      // the user's chat message has already been saved at this point.
      this.logger.warn(`moderation check failed: ${err?.message ?? err}`);
      return null;
    }

    if (!result || !result.flagged) return result;

    try {
      await (this.prisma as any).flaggedMessage.create({
        data: {
          messageId: params.messageId,
          userId: params.userId,
          categories: result.categories,
          scores: result.scores as any,
          // Default status pending — admin reviews via SafetyTab.
        },
      });
    } catch (err: any) {
      this.logger.error(`flagged_messages insert failed: ${err?.message ?? err}`);
    }

    return result;
  }
}
