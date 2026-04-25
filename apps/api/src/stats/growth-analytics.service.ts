import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';
import {
  computeMrrUsd,
  computeMomDelta,
  projectMrrSixMonths,
} from './stats.service';

// ─── Response shapes ──────────────────────────────────────────────────────

export interface FunnelStage {
  stage: 'signup' | 'profile_complete' | 'first_chat' | 'first_payment' | 'renewal';
  label: string;
  count: number;
  /** Conversion from the prior stage, 0..1. 1 for the signup stage itself. */
  conversionFromPrev: number;
  /** Conversion from the initial signup stage, 0..1. */
  conversionFromSignup: number;
}

export interface FunnelCounts {
  windowDays: number;
  locale: string | null;
  totalSignups: number;
  stages: FunnelStage[];
}

export interface CohortRow {
  /** ISO date (Monday) of the cohort week. */
  cohortWeek: string;
  /** Number of users that signed up in this cohort week. */
  size: number;
  /**
   * Retention percentages keyed by week offset 0..N. retention[0] is
   * always 100 (week 0 = signup week). Length = requested window.
   */
  retention: number[];
}

export interface MrrSnapshot {
  mrrUsd: number;
  arrUsd: number;
  /** Month-over-month delta as a fraction (0.12 = +12%). */
  momDelta: number;
  /** Naive 6-month projection based on MoM delta. */
  projection6m: number;
  /** Date of the latest StatDaily row used to derive these numbers. */
  asOf: string | null;
}

export interface LtvArpuSnapshot {
  totalRevenueUsd: number;
  subscriberCount: number;
  arpuUsd: number;
  /** Simple LTV proxy: ARPU / churn rate (falls back to totalRevenue/subscribers). */
  ltvUsd: number;
}

export interface ChurnRiskRow {
  userId: string;
  email: string;
  name: string;
  /**
   * Populated only for `reason: 'inactive'` rows. Payment-fail rows
   * don't necessarily have an active subscription (the renewal charge
   * may have already failed them out of ACTIVE status), so they leave
   * the field null.
   */
  subscriptionId: string | null;
  plan: string | null;
  endDate: string | null;
  lastChatAt: string | null;
  daysSinceLastChat: number | null;
  /**
   * Why this user is on the risk list:
   *   `inactive`     — premium user with last chat > 14d ago AND renewal ≤ 14d
   *   `payment_fail` — ≥ 2 FAILED payments in the last 30d (Phase 4 signal)
   */
  reason: 'inactive' | 'payment_fail';
  /** Count of recent failed payments — only set when reason='payment_fail'. */
  recentFailedPayments?: number;
}

export interface PaymentFailureRow {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class GrowthAnalyticsService {
  private readonly logger = new Logger(GrowthAnalyticsService.name);
  private readonly readPrisma: PrismaService;

  constructor(
    private readonly prisma: PrismaService,
    readReplicaPrisma: PrismaReadReplicaService,
  ) {
    this.readPrisma = readReplicaPrisma as unknown as PrismaService;
  }

  // ────────────────────────────────────────────────────────────────────
  // Funnel
  // ────────────────────────────────────────────────────────────────────

  /**
   * Count users flowing through the core acquisition funnel in the last
   * `days` window. Stages are defined as cumulative predicates on the
   * signup cohort — a user who reaches `first_payment` is counted at
   * all three prior stages too. That's what makes the conversion
   * ratios meaningful across the whole funnel.
   */
  async getFunnel(opts: { days: number; locale?: string | null }): Promise<FunnelCounts> {
    const days = clampDays(opts.days);
    const locale = (opts.locale ?? '').trim() || null;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Base predicate: users who signed up within the window, optionally
    // filtered to a single locale. Every downstream stage narrows this
    // candidate set; we only ever count rows from it.
    const baseWhere: any = { createdAt: { gte: since } };
    if (locale) baseWhere.locale = locale;

    const [signups, profileComplete, firstChat, firstPayment, renewal] = await Promise.all([
      this.readPrisma.user.count({ where: baseWhere }),
      this.readPrisma.user.count({
        where: {
          ...baseWhere,
          dateOfBirth: { not: null },
          timeOfBirth: { not: null },
          gender: { not: null },
          placeOfBirth: { not: undefined } as any,
        },
      }),
      this.readPrisma.user.count({
        where: { ...baseWhere, chatSessions: { some: {} } },
      }),
      this.readPrisma.user.count({
        where: {
          ...baseWhere,
          payments: { some: { status: 'SUCCESS' } },
        },
      }),
      // Renewal = ≥ 2 successful SUBSCRIPTION payments. Prisma lacks
      // "having count >= 2" on relation filters, so we pull user ids
      // with ≥ 2 SUBSCRIPTION payments via groupBy then count the
      // intersection with our base set. Payment.userId is indexed so
      // this is cheap.
      (async () => {
        const groups = await this.readPrisma.payment.groupBy({
          by: ['userId'],
          where: { status: 'SUCCESS', type: 'SUBSCRIPTION' },
          _count: { _all: true },
          having: { userId: { _count: { gte: 2 } } },
        } as any);
        const renewalUserIds = groups.map((g: any) => g.userId);
        if (renewalUserIds.length === 0) return 0;
        return this.readPrisma.user.count({
          where: { ...baseWhere, id: { in: renewalUserIds } },
        });
      })(),
    ]);

    const stages: FunnelStage[] = [
      buildStage('signup',           'Sign up',             signups,         signups, signups),
      buildStage('profile_complete', 'Profile complete',    profileComplete, signups, signups),
      buildStage('first_chat',       'First chat',          firstChat,       profileComplete, signups),
      buildStage('first_payment',    'First payment',       firstPayment,    firstChat, signups),
      buildStage('renewal',          'Renewal (2nd pay)',   renewal,         firstPayment, signups),
    ];

    return {
      windowDays: days,
      locale,
      totalSignups: signups,
      stages,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Cohort retention
  // ────────────────────────────────────────────────────────────────────

  /**
   * Weekly signup cohorts with a retention grid. A user is considered
   * active in week N if they created at least one chat session in that
   * ISO-week (Monday-based, aligned to the cohort anchor).
   *
   * Activity is aggregated in a single Postgres query that joins users
   * onto chat_sessions and groups by (cohort_week, week_offset). Cohort
   * sizes are pulled with a separate groupBy so we can divide in JS
   * without introducing a correlated subquery for each row.
   */
  async getCohorts(opts: { weeks: number; locale?: string | null }): Promise<CohortRow[]> {
    const weeks = clampWeeks(opts.weeks);
    const locale = (opts.locale ?? '').trim() || null;

    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);
    // Align to Monday of the week containing `since` so the oldest
    // cohort bucket is a full week rather than a partial one.
    since.setUTCHours(0, 0, 0, 0);
    const weekday = (since.getUTCDay() + 6) % 7; // 0 = Monday
    since.setUTCDate(since.getUTCDate() - weekday);

    // 1) Cohort sizes per signup week, optionally filtered by locale.
    const sizeRows = await this.readPrisma.$queryRawUnsafe<Array<{ cohort_week: Date; size: bigint }>>(
      `
      SELECT
        DATE_TRUNC('week', "createdAt" AT TIME ZONE 'UTC')::date AS cohort_week,
        COUNT(*)::bigint AS size
      FROM "users"
      WHERE "createdAt" >= $1::timestamptz
        ${locale ? 'AND "locale" = $2' : ''}
      GROUP BY cohort_week
      ORDER BY cohort_week ASC
      `,
      ...(locale ? [since, locale] : [since]),
    );

    // 2) Active-user count per (cohort_week, week_offset). Single SQL
    // grouping — the plan explicitly calls this out. Week offset is the
    // floor of (activity_at - cohort_week) / 7 days.
    const activityRows = await this.readPrisma.$queryRawUnsafe<
      Array<{ cohort_week: Date; week_offset: number; active: bigint }>
    >(
      `
      SELECT
        DATE_TRUNC('week', u."createdAt" AT TIME ZONE 'UTC')::date AS cohort_week,
        FLOOR(
          EXTRACT(EPOCH FROM (cs."createdAt" - DATE_TRUNC('week', u."createdAt" AT TIME ZONE 'UTC')))
          / 604800
        )::int AS week_offset,
        COUNT(DISTINCT u."id")::bigint AS active
      FROM "users" u
      INNER JOIN "chat_sessions" cs ON cs."userId" = u."id"
      WHERE u."createdAt" >= $1::timestamptz
        AND cs."createdAt" >= DATE_TRUNC('week', u."createdAt" AT TIME ZONE 'UTC')
        ${locale ? 'AND u."locale" = $2' : ''}
      GROUP BY cohort_week, week_offset
      ORDER BY cohort_week ASC, week_offset ASC
      `,
      ...(locale ? [since, locale] : [since]),
    );

    return stitchCohortGrid(sizeRows, activityRows, weeks);
  }

  // ────────────────────────────────────────────────────────────────────
  // MRR tile
  // ────────────────────────────────────────────────────────────────────

  /**
   * MRR / ARR / MoM delta / 6m projection, derived from the StatDaily
   * rollup. Falls back to live aggregation when the rollup hasn't run
   * yet (fresh deploy, empty stats_daily table).
   */
  async getMrr(): Promise<MrrSnapshot> {
    const latest = await this.readPrisma.statDaily.findFirst({
      orderBy: { date: 'desc' },
    });

    const mrrUsd = latest ? Number((latest as any).mrrUsd ?? 0) : await this.liveMrrUsd();

    // Prior month's MRR: most recent StatDaily row from ~30d ago.
    const priorDate = new Date();
    priorDate.setDate(priorDate.getDate() - 30);
    const prior = await this.readPrisma.statDaily.findFirst({
      where: { date: { lte: priorDate } },
      orderBy: { date: 'desc' },
    });
    const priorMrr = prior ? Number((prior as any).mrrUsd ?? 0) : 0;

    const momDelta = computeMomDelta(mrrUsd, priorMrr);
    const projection6m = projectMrrSixMonths(mrrUsd, momDelta);

    return {
      mrrUsd,
      arrUsd: Math.round(mrrUsd * 12 * 100) / 100,
      momDelta,
      projection6m,
      asOf: latest ? (latest.date as Date).toISOString() : null,
    };
  }

  /**
   * Cold-start path: if stats_daily hasn't populated yet, do the
   * MRR math live against the same inputs `computeAndStoreDailyStats`
   * uses so the tile never shows zero on a fresh deploy.
   */
  private async liveMrrUsd(): Promise<number> {
    const [activeByPlan, pricing] = await Promise.all([
      this.readPrisma.subscription.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.readPrisma.siteSetting.findMany({
        where: {
          key: {
            in: ['pricing.monthly.price', 'pricing.annual.price', 'pricing.fx.inr_to_usd'],
          },
        },
        select: { key: true, value: true },
      }),
    ]);
    return computeMrrUsd(activeByPlan as any, pricing as any);
  }

  /**
   * LTV / ARPU tiles. ARPU is total lifetime revenue divided by the
   * number of paying users (anyone with ≥1 successful payment). LTV is
   * computed as ARPU / monthly-churn-rate — falls back to ARPU when
   * churn is zero (a new business with no canceled subs yet).
   */
  async getLtvArpu(): Promise<LtvArpuSnapshot> {
    const [revenueAgg, subscriberCount, activeCount, recentChurn] = await Promise.all([
      this.readPrisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.readPrisma.user.count({ where: { payments: { some: { status: 'SUCCESS' } } } }),
      this.readPrisma.subscription.count({ where: { status: 'ACTIVE' } }),
      // 30-day churn for the LTV denominator
      this.readPrisma.subscription.count({
        where: {
          status: { in: ['CANCELLED', 'EXPIRED'] },
          endDate: { gte: new Date(Date.now() - 30 * 86400 * 1000) },
        },
      }),
    ]);

    const fxSetting = await this.readPrisma.siteSetting.findMany({
      where: { key: { in: ['pricing.fx.inr_to_usd'] } },
      select: { key: true, value: true },
    });
    const fx = (() => {
      const raw = fxSetting.find((r: { key: string; value: string }) => r.key === 'pricing.fx.inr_to_usd')?.value;
      const n = raw ? Number(raw) : 0.012;
      return Number.isFinite(n) && n > 0 ? n : 0.012;
    })();

    const totalRevenueInr = Number(revenueAgg._sum.amount ?? 0);
    const totalRevenueUsd = Math.round(totalRevenueInr * fx * 100) / 100;
    const arpuUsd = subscriberCount > 0 ? totalRevenueUsd / subscriberCount : 0;
    const churnRate = activeCount > 0 ? recentChurn / activeCount : 0;
    const ltvUsd = churnRate > 0 ? arpuUsd / churnRate : arpuUsd;

    return {
      totalRevenueUsd,
      subscriberCount,
      arpuUsd: Math.round(arpuUsd * 100) / 100,
      ltvUsd: Math.round(ltvUsd * 100) / 100,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Churn risk list
  // ────────────────────────────────────────────────────────────────────

  /**
   * Premium users whose active subscription renews in the next 14 days
   * AND whose last chat was more than 14 days ago (or never). These
   * are the accounts worth reaching out to before the renewal fires.
   */
  async getChurnRisk(opts: { limit: number }): Promise<ChurnRiskRow[]> {
    const limit = clampLimit(opts.limit);
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 86400 * 1000);
    const chatCutoff = new Date(now.getTime() - 14 * 86400 * 1000);
    const paymentWindow = new Date(now.getTime() - 30 * 86400 * 1000);

    // ── Inactive-renewal signal (Phase 2 original behavior) ───────────
    // Subscriptions ending soon + their user. We pull extra so we can
    // post-filter by last-chat recency (Prisma can't order by a related
    // aggregate in a single where clause).
    const subs = await this.readPrisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { not: null, lte: in14Days, gte: now },
      },
      orderBy: { endDate: 'asc' },
      take: limit * 3,
      select: {
        id: true,
        plan: true,
        endDate: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            chatSessions: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { updatedAt: true },
            },
          },
        },
      },
    });

    const rows: ChurnRiskRow[] = [];
    const seenUserIds = new Set<string>();
    for (const s of subs) {
      const lastChat = s.user.chatSessions[0]?.updatedAt ?? null;
      if (lastChat && lastChat > chatCutoff) continue; // recently active — not at risk
      const daysSince = lastChat
        ? Math.floor((now.getTime() - lastChat.getTime()) / 86400000)
        : null;
      rows.push({
        userId: s.user.id,
        email: s.user.email,
        name: s.user.name,
        subscriptionId: s.id,
        plan: s.plan,
        endDate: s.endDate ? s.endDate.toISOString() : null,
        lastChatAt: lastChat ? lastChat.toISOString() : null,
        daysSinceLastChat: daysSince,
        reason: 'inactive',
      });
      seenUserIds.add(s.user.id);
      if (rows.length >= limit) break;
    }

    // ── Phase 4 payment-failure signal ───────────────────────────────
    // Users with ≥ 2 FAILED payments in the last 30 days. We join
    // via Prisma groupBy + having because Payment.userId is indexed
    // and the set is small relative to the full payments table.
    // De-dup: if the same user already appears via the inactive
    // signal, we'd rather not show them twice — the inactive row
    // carries more context.
    if (rows.length < limit) {
      const failGroups = await this.readPrisma.payment.groupBy({
        by: ['userId'],
        where: {
          status: 'FAILED',
          createdAt: { gte: paymentWindow },
        },
        _count: { _all: true },
        having: { userId: { _count: { gte: 2 } } },
      } as any);

      const flaggedUserIds = (failGroups as any[])
        .map((g) => g.userId)
        .filter((id: string) => !seenUserIds.has(id));

      if (flaggedUserIds.length > 0) {
        const users = await this.readPrisma.user.findMany({
          where: { id: { in: flaggedUserIds } },
          select: { id: true, email: true, name: true },
        });
        const userById = new Map<string, { id: string; email: string; name: string }>(
          users.map((u: any) => [u.id as string, u as { id: string; email: string; name: string }]),
        );
        const countById = new Map<string, number>(
          (failGroups as any[]).map((g) => [g.userId as string, g._count?._all ?? 0]),
        );
        for (const userId of flaggedUserIds) {
          const user = userById.get(userId);
          if (!user) continue;
          rows.push({
            userId,
            email: user.email,
            name: user.name,
            subscriptionId: null,
            plan: null,
            endDate: null,
            lastChatAt: null,
            daysSinceLastChat: null,
            reason: 'payment_fail',
            recentFailedPayments: countById.get(userId) ?? 0,
          });
          if (rows.length >= limit) break;
        }
      }
    }

    return rows;
  }

  // ────────────────────────────────────────────────────────────────────
  // Payment failures
  // ────────────────────────────────────────────────────────────────────

  /**
   * Payments in FAILED / REFUNDED status within the last `days` window.
   * Trimmed shape — enough to render a table row without leaking
   * Razorpay internals into the admin UI.
   */
  async getPaymentFailures(opts: { days: number }): Promise<PaymentFailureRow[]> {
    const days = clampDays(opts.days);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const payments = await this.readPrisma.payment.findMany({
      where: {
        status: { in: ['FAILED', 'REFUNDED'] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        status: true,
        type: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    });

    return payments.map((p: any) => ({
      id: p.id,
      userId: p.userId,
      userEmail: p.user.email,
      userName: p.user.name,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      type: p.type,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

function clampWeeks(n: number): number {
  if (!Number.isFinite(n)) return 12;
  return Math.min(52, Math.max(1, Math.floor(n)));
}

function clampLimit(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(500, Math.max(1, Math.floor(n)));
}

function buildStage(
  stage: FunnelStage['stage'],
  label: string,
  count: number,
  prevCount: number,
  signups: number,
): FunnelStage {
  const conversionFromPrev = prevCount > 0 ? count / prevCount : 0;
  const conversionFromSignup = signups > 0 ? count / signups : 0;
  return {
    stage,
    label,
    count,
    conversionFromPrev: roundFrac(conversionFromPrev),
    conversionFromSignup: roundFrac(conversionFromSignup),
  };
}

function roundFrac(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Assemble the cohort retention grid from the two raw queries. Exposed
 * for unit tests — the math is independent of Prisma so we can pass
 * in a fixture of 100 users × 4 weeks and assert the grid directly.
 */
export function stitchCohortGrid(
  sizeRows: Array<{ cohort_week: Date | string; size: bigint | number }>,
  activityRows: Array<{ cohort_week: Date | string; week_offset: number; active: bigint | number }>,
  windowWeeks: number,
): CohortRow[] {
  const weeks = Math.max(1, windowWeeks);
  const sizeByWeek = new Map<string, number>();
  for (const r of sizeRows) {
    const key = toIsoDate(r.cohort_week);
    sizeByWeek.set(key, Number(r.size));
  }

  // Build an activity lookup { cohortKey → { weekOffset → activeCount } }.
  const activityByWeek = new Map<string, Map<number, number>>();
  for (const r of activityRows) {
    const key = toIsoDate(r.cohort_week);
    if (!activityByWeek.has(key)) activityByWeek.set(key, new Map());
    activityByWeek.get(key)!.set(r.week_offset, Number(r.active));
  }

  const out: CohortRow[] = [];
  for (const [cohortKey, size] of sizeByWeek) {
    const activity = activityByWeek.get(cohortKey) ?? new Map<number, number>();
    const retention: number[] = [];
    for (let i = 0; i < weeks; i++) {
      const active = activity.get(i) ?? 0;
      // Week 0 is always 100% — signups ARE the cohort. Later weeks
      // are divided by the cohort size; if we somehow saw more
      // distinct actives than the cohort size, clamp to 100.
      const pct = size > 0 ? Math.min(100, Math.round((active / size) * 1000) / 10) : 0;
      retention.push(pct);
    }
    out.push({ cohortWeek: cohortKey, size, retention });
  }

  // Ascending by week so the oldest cohort is first — that's what the
  // grid UI expects (rows top-to-bottom = oldest-to-newest).
  out.sort((a, b) => (a.cohortWeek < b.cohortWeek ? -1 : 1));
  return out;
}

function toIsoDate(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  // Postgres returns DATE columns as 'YYYY-MM-DD' strings through
  // $queryRawUnsafe — use as-is after a defensive slice in case of
  // timestamp padding.
  return String(d).slice(0, 10);
}
