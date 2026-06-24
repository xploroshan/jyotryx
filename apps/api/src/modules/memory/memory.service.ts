import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Free-form-ish categories. Kept small; unknown values fall back to 'fact'. */
export const MEMORY_KINDS = ['fact', 'preference', 'goal', 'event'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/**
 * Compose the compact "what the user told me before" block injected into the
 * chat system prompt. Pure and side-effect-free so it is trivially testable and
 * never recomputes anything. Returns '' when there is nothing to recall.
 */
export function formatMemoryBlock(memories: { kind: string; content: string }[]): string {
  if (!memories.length) return '';
  const lines = memories.map((m) => `- ${m.content}`);
  return (
    `\n\nWhat the user has shared with you before (use it to personalize your ` +
    `guidance; do not list it back verbatim unless it is relevant):\n${lines.join('\n')}`
  );
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  /** Hard caps so the store and the injected prompt stay bounded. */
  static readonly MAX_MEMORIES = 100;
  static readonly MAX_CONTENT_LEN = 500;
  /** How many memories (pinned first) are folded into the chat prompt. */
  static readonly PROMPT_LIMIT = 20;

  constructor(private prisma: PrismaService) {}

  /** All of a user's memories, pinned first then newest-first. */
  async list(userId: string) {
    return this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async add(userId: string, dto: { content?: string; kind?: string }) {
    const content = (dto.content ?? '').trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }
    if (content.length > MemoryService.MAX_CONTENT_LEN) {
      throw new BadRequestException(`content must be ${MemoryService.MAX_CONTENT_LEN} characters or fewer`);
    }
    const count = await this.prisma.userMemory.count({ where: { userId } });
    if (count >= MemoryService.MAX_MEMORIES) {
      throw new BadRequestException(`You can store at most ${MemoryService.MAX_MEMORIES} memories.`);
    }
    const kind: MemoryKind = (MEMORY_KINDS as readonly string[]).includes(dto.kind ?? '')
      ? (dto.kind as MemoryKind)
      : 'fact';
    return this.prisma.userMemory.create({
      data: { userId, content, kind, source: 'user' },
    });
  }

  /** Delete one memory, scoped to its owner so users can't touch others' rows. */
  async remove(userId: string, id: string) {
    const result = await this.prisma.userMemory.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      throw new NotFoundException('Memory not found');
    }
    return { deleted: true };
  }

  /**
   * Build the compact memory block for the chat prompt — pinned first, capped
   * at PROMPT_LIMIT entries so the system prompt can't grow without bound.
   */
  async buildMemoryBlock(userId: string): Promise<string> {
    const memories = await this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: MemoryService.PROMPT_LIMIT,
      select: { kind: true, content: true },
    });
    return formatMemoryBlock(memories);
  }
}
