import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';
import { GdprPurgeService } from '../modules/admin/gdpr-purge.service';

// ─── Response shapes ──────────────────────────────────────────────────────

export type GdprStatus = 'pending' | 'fulfilled' | 'rejected';
export type GdprType   = 'export' | 'delete';

export interface GdprRequestRow {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  type: GdprType;
  status: GdprStatus;
  dueBy: string;
  /** Whole days between now and dueBy. Negative = overdue. */
  daysUntilDue: number;
  fulfilledAt: string | null;
  adminId: string | null;
  note: string | null;
  createdAt: string;
}

export interface UserDataExport {
  userId: string;
  user: any;
  subscriptions: any[];
  payments: any[];
  chatSessions: any[];
  kundliCharts: any[];
  reports: any[];
  creditTransactions: any[];
  tarotReadings: any[];
  matchingResults: any[];
  palmistryReadings: any[];
  exportedAt: string;
}

const SLA_DAYS = 30;

@Injectable()
export class GdprRequestService {
  private readonly logger = new Logger(GdprRequestService.name);
  private readonly readPrisma: PrismaService;

  constructor(
    private readonly prisma: PrismaService,
    readReplica: PrismaReadReplicaService,
    private readonly purgeService: GdprPurgeService,
  ) {
    this.readPrisma = readReplica as unknown as PrismaService;
  }

  /**
   * Create a GDPR request (export or delete). Called either by a
   * user-facing endpoint (not part of Phase 4 admin surface — placeholder
   * for a later "Settings → Download my data" flow) or by the admin
   * seeding a request on the user's behalf.
   *
   * Enforces one pending request per (userId, type) — repeating is
   * pointless and makes the SLA tracker noisy.
   */
  async create(params: { userId: string; type: GdprType; note?: string }): Promise<GdprRequestRow> {
    const { userId, type } = params;
    if (type !== 'export' && type !== 'delete') {
      throw new BadRequestException(`Unsupported GDPR type: ${type}`);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const existing = await (this.prisma as any).gdprRequest.findFirst({
      where: { userId, type, status: 'pending' },
    });
    if (existing) {
      // Idempotency: return the existing row rather than creating a
      // duplicate pending request.
      return this.enrichRow(existing, user);
    }

    const dueBy = new Date(Date.now() + SLA_DAYS * 86400 * 1000);
    const row = await (this.prisma as any).gdprRequest.create({
      data: {
        userId,
        type,
        dueBy,
        note: params.note ?? null,
      },
    });
    this.logger.log(`GDPR request created: type=${type} user=${user.email} dueBy=${dueBy.toISOString()}`);
    return this.enrichRow(row, user);
  }

  /**
   * Listing for the admin GDPR tab. Defaults to pending, sorted by
   * nearest-SLA-first so the queue surfaces breach risk at the top.
   */
  async list(opts: { status?: GdprStatus; limit?: number }): Promise<GdprRequestRow[]> {
    const status = opts.status ?? 'pending';
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50));

    const rows = await (this.readPrisma as any).gdprRequest.findMany({
      where: { status },
      // Pending rows: nearest due first (most urgent). Fulfilled/rejected:
      // newest first (most relevant for audit review).
      orderBy: status === 'pending' ? { dueBy: 'asc' } : { fulfilledAt: 'desc' },
      take: limit,
    });
    if (rows.length === 0) return [];

    const userIds = Array.from(new Set(rows.map((r: any) => r.userId))) as string[];
    const users = await this.readPrisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const userById = new Map<string, { id: string; email: string; name: string }>(
      users.map((u: any) => [u.id as string, u as { id: string; email: string; name: string }]),
    );

    return rows.map((r: any) => this.enrichRow(r, userById.get(r.userId) ?? null));
  }

  /**
   * Fulfill a GDPR request. For "delete", this calls the existing
   * `GdprPurgeService.purgeUserData()` then removes the user row —
   * the same atomic deletion path AdminService.deleteUser uses, just
   * triggered by the GDPR queue instead of direct admin action. For
   * "export", the caller is expected to consume the returned payload
   * (it isn't persisted — the only copy is the admin's download).
   *
   * Returns the fulfilled row + an optional payload for export flows.
   * Logs to the admin activity log is the caller's responsibility.
   */
  async fulfill(
    requestId: string,
    adminId: string,
    note?: string,
  ): Promise<{ row: GdprRequestRow; exportPayload?: UserDataExport }> {
    const existing = await (this.prisma as any).gdprRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new NotFoundException('GDPR request not found');
    if (existing.status !== 'pending') {
      throw new BadRequestException(`Request is already ${existing.status}`);
    }

    let exportPayload: UserDataExport | undefined;
    if (existing.type === 'export') {
      exportPayload = await this.buildExport(existing.userId);
    } else if (existing.type === 'delete') {
      await this.purgeService.purgeUserData(existing.userId);
      // Removing the user row cascades to owned records (subscriptions,
      // chat_sessions, etc.) because their FKs are onDelete: Cascade.
      // Partitioned tables were purged above via purgeService.
      await this.prisma.user.delete({ where: { id: existing.userId } }).catch((err: any) => {
        // User may already be gone (race with AdminService.deleteUser).
        // Treat missing-user as idempotent success.
        if (err?.code !== 'P2025') throw err;
      });
    }

    const updated = await (this.prisma as any).gdprRequest.update({
      where: { id: requestId },
      data: {
        status: 'fulfilled',
        fulfilledAt: new Date(),
        adminId,
        note: note ?? existing.note ?? null,
      },
    });

    const user = await this.readPrisma.user.findUnique({
      where: { id: existing.userId },
      select: { id: true, email: true, name: true },
    });
    return { row: this.enrichRow(updated, user), exportPayload };
  }

  /**
   * Admin rejection path. Keeps the row in the audit trail but marks
   * it non-fulfillable. Used when the request is fraudulent / the
   * account is disputed.
   */
  async reject(requestId: string, adminId: string, note: string): Promise<GdprRequestRow> {
    if (!note || note.trim().length === 0) {
      throw new BadRequestException('Rejection requires a note explaining why');
    }
    const existing = await (this.prisma as any).gdprRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new NotFoundException('GDPR request not found');
    if (existing.status !== 'pending') {
      throw new BadRequestException(`Request is already ${existing.status}`);
    }

    const updated = await (this.prisma as any).gdprRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        fulfilledAt: new Date(),
        adminId,
        note,
      },
    });
    const user = await this.readPrisma.user.findUnique({
      where: { id: existing.userId },
      select: { id: true, email: true, name: true },
    });
    return this.enrichRow(updated, user);
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  /**
   * Build a portable JSON dump of a user's owned records across every
   * model we know holds their data. Reads only — no side effects on
   * either DB. Partitioned tables (chat_messages, llm_usage,
   * notifications) are NOT included here because Phase 4 scope says
   * the export surface is JSON the admin downloads; shipping
   * partitioned partial data would be misleading without a matching
   * manifest. Future work can grow this payload.
   */
  private async buildExport(userId: string): Promise<UserDataExport> {
    const user = await this.readPrisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
        payments: true,
        chatSessions: true,
        kundliCharts: true,
        reports: true,
        creditTransactions: true,
        tarotReadings: true,
        matchingResults: true,
        palmistryReadings: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const anyUser = user as any;

    return {
      userId,
      user: {
        id: anyUser.id,
        email: anyUser.email,
        name: anyUser.name,
        phone: anyUser.phone,
        createdAt: anyUser.createdAt,
        role: anyUser.role,
        locale: anyUser.locale,
      },
      subscriptions: anyUser.subscriptions,
      payments: anyUser.payments,
      chatSessions: anyUser.chatSessions,
      kundliCharts: anyUser.kundliCharts,
      reports: anyUser.reports,
      creditTransactions: anyUser.creditTransactions,
      tarotReadings: anyUser.tarotReadings,
      matchingResults: anyUser.matchingResults,
      palmistryReadings: anyUser.palmistryReadings,
      exportedAt: new Date().toISOString(),
    };
  }

  private enrichRow(
    r: any,
    user: { email: string; name: string } | null,
  ): GdprRequestRow {
    const daysUntilDue = Math.floor((r.dueBy.getTime() - Date.now()) / 86400000);
    return {
      id: r.id,
      userId: r.userId,
      userEmail: user?.email ?? null,
      userName: user?.name ?? null,
      type: r.type as GdprType,
      status: r.status as GdprStatus,
      dueBy: r.dueBy.toISOString(),
      daysUntilDue,
      fulfilledAt: r.fulfilledAt ? r.fulfilledAt.toISOString() : null,
      adminId: r.adminId ?? null,
      note: r.note ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
