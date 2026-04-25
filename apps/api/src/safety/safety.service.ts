import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';

// ─── Response shapes ──────────────────────────────────────────────────────

export type FlaggedStatus = 'pending' | 'approved' | 'hidden' | 'actioned';

export interface FlaggedMessageRow {
  id: string;
  messageId: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  categories: string[];
  scores: Record<string, number>;
  status: FlaggedStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Content preview loaded from chat_messages (first 280 chars). */
  preview: string | null;
}

export type ResolveAction = 'approve' | 'hide' | 'actioned';

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);
  private readonly readPrisma: PrismaService;

  constructor(
    private readonly prisma: PrismaService,
    readReplica: PrismaReadReplicaService,
  ) {
    this.readPrisma = readReplica as unknown as PrismaService;
  }

  /**
   * Listing for the Safety tab. Defaults to the pending queue; the
   * admin can also request historical state transitions for audit.
   * Each row is enriched with the user's email/name and a content
   * preview pulled from `chat_messages` — the moderation row itself
   * doesn't store the content, so we join at read time to avoid
   * duplicating text across tables.
   */
  async list(opts: { status?: FlaggedStatus; limit?: number }): Promise<FlaggedMessageRow[]> {
    const status: FlaggedStatus = opts.status ?? 'pending';
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50));

    const rows = await (this.readPrisma as any).flaggedMessage.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    if (rows.length === 0) return [];

    // Batch-fetch the user and message payloads we need — a per-row
    // `user.findUnique` inside a loop would be O(N) round trips.
    const userIds = Array.from(new Set(rows.map((r: any) => r.userId)));
    const messageIds = Array.from(new Set(rows.map((r: any) => r.messageId)));

    const [users, messages] = await Promise.all([
      this.readPrisma.user.findMany({
        where: { id: { in: userIds as string[] } },
        select: { id: true, email: true, name: true },
      }),
      this.readPrisma.chatMessage.findMany({
        where: { id: { in: messageIds as string[] } },
        select: { id: true, content: true },
      }),
    ]);
    const userById = new Map(users.map((u: any) => [u.id, u]));
    const msgById  = new Map(messages.map((m: any) => [m.id, m]));

    return rows.map((r: any) => {
      const user = userById.get(r.userId) as { email: string; name: string } | undefined;
      const msg  = msgById.get(r.messageId) as { content: string } | undefined;
      return {
        id: r.id,
        messageId: r.messageId,
        userId: r.userId,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
        categories: r.categories ?? [],
        scores: (r.scores ?? {}) as Record<string, number>,
        status: r.status as FlaggedStatus,
        reviewedBy: r.reviewedBy ?? null,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        preview: msg ? msg.content.slice(0, 280) : null,
      };
    });
  }

  /**
   * State transition. `pending` is the only valid starting state —
   * re-resolving a row is a no-op-ish error that we surface as a
   * 400 so an admin double-clicking doesn't silently overwrite
   * someone else's decision.
   */
  async resolve(
    flaggedId: string,
    action: ResolveAction,
    adminId: string,
  ): Promise<FlaggedMessageRow> {
    const existing = await (this.prisma as any).flaggedMessage.findUnique({ where: { id: flaggedId } });
    if (!existing) throw new NotFoundException('Flagged message not found');
    if (existing.status !== 'pending') {
      throw new BadRequestException(`Flagged message is already ${existing.status}`);
    }

    const nextStatus: FlaggedStatus =
      action === 'approve' ? 'approved' :
      action === 'hide'    ? 'hidden'   :
                             'actioned';

    await (this.prisma as any).flaggedMessage.update({
      where: { id: flaggedId },
      data: {
        status: nextStatus,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    const [row] = await this.list({ status: nextStatus, limit: 1 });
    // The listing filters by status; if the row isn't in the top 1 of
    // that status (possible under concurrent resolves), fall back to
    // an enriched single-row read so the caller always sees the new
    // state.
    if (row && row.id === flaggedId) return row;
    const refetched = await (this.readPrisma as any).flaggedMessage.findUnique({ where: { id: flaggedId } });
    return enrich(refetched, null, null);
  }
}

function enrich(r: any, user: { email: string; name: string } | null, content: string | null): FlaggedMessageRow {
  return {
    id: r.id,
    messageId: r.messageId,
    userId: r.userId,
    userEmail: user?.email ?? null,
    userName: user?.name ?? null,
    categories: r.categories ?? [],
    scores: (r.scores ?? {}) as Record<string, number>,
    status: r.status as FlaggedStatus,
    reviewedBy: r.reviewedBy ?? null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    preview: content ? content.slice(0, 280) : null,
  };
}
