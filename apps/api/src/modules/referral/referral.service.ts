import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReferralSettings {
  enabled: boolean;
  bonusDays: number;
  maxPerReferrer: number;
}

export interface ReferralStatus {
  enabled: boolean;
  bonusDays: number;
  code: string;
  shareUrl: string;
  totalReferrals: number;
  activatedReferrals: number;
  pendingReferrals: number;
  rejectedReferrals: number;
  maxPerReferrer: number;
  remainingSlots: number;
  recent: Array<{
    refereeName: string;
    refereeEmail: string;
    bonusDays: number;
    status: string;
    activatedAt: string | null;
    createdAt: string;
  }>;
}

const DEFAULTS: ReferralSettings = {
  enabled: true,
  bonusDays: 30,
  maxPerReferrer: 10,
};

const HARD_MAX_BONUS_DAYS = 365;
const HARD_MAX_PER_REFERRER = 100;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const CODE_LENGTH = 8;

/**
 * Phase 1 monetization — referral program.
 *
 * Both sides of a successful referral receive `referral.bonus_days` of
 * Premium. The duration and the on/off switch are read from
 * `site_settings` at activation time, so an admin flip from the
 * Settings tab takes effect on the very next signup with no redeploy.
 *
 * Activation is **signup-time** in the current implementation: the
 * moment a new user registers with a valid `?ref=…` code, both sides
 * are upgraded. The schema (`Referral.status` + the PENDING enum
 * value) is intentionally a superset so a future "first paying
 * action" trigger can land without another migration — it would just
 * insert PENDING rows here and have a separate hook flip them to
 * ACTIVATED.
 */
@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings ──────────────────────────────────────────────────────────

  async getSettings(): Promise<ReferralSettings> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'referral.' } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      enabled: parseBoolean(map['referral.enabled'], DEFAULTS.enabled),
      bonusDays: clampInt(
        map['referral.bonus_days'],
        DEFAULTS.bonusDays,
        1,
        HARD_MAX_BONUS_DAYS,
      ),
      maxPerReferrer: clampInt(
        map['referral.max_per_referrer'],
        DEFAULTS.maxPerReferrer,
        1,
        HARD_MAX_PER_REFERRER,
      ),
    };
  }

  // ─── Code generation / lookup ──────────────────────────────────────────

  /**
   * Idempotent: returns the user's existing code or mints one. Uses a
   * retry loop because the alphabet is small enough that a collision
   * is theoretically possible (1 in 32^8 ≈ 10^12 — practically never,
   * but the unique index will reject it cleanly if it ever happens).
   */
  async getOrCreateCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateCode();
      try {
        const updated = await this.prisma.user.update({
          where: { id: userId },
          data: { referralCode: candidate },
          select: { referralCode: true },
        });
        return updated.referralCode!;
      } catch (err: any) {
        // Prisma surfaces the unique-violation as P2002 — retry with a
        // fresh code. Anything else is a real failure.
        if (err?.code !== 'P2002') throw err;
      }
    }
    throw new Error('Failed to generate a unique referral code after 5 attempts');
  }

  async findByCode(code: string): Promise<{ id: string; email: string } | null> {
    const trimmed = (code || '').trim().toUpperCase();
    if (!trimmed) return null;
    const user = await this.prisma.user.findUnique({
      where: { referralCode: trimmed },
      select: { id: true, email: true },
    });
    return user;
  }

  // ─── Activation ────────────────────────────────────────────────────────

  /**
   * Called from auth.service immediately after a new user is created.
   *
   * Returns silently on every "soft" failure (program disabled, code
   * not found, self-referral, cap reached) so that signup itself never
   * fails just because the referral logic decided not to grant the
   * bonus. The reason lands in the logs and, for capped/disabled
   * cases, in the persisted Referral row's `rejectedReason` for
   * admin visibility.
   */
  async activateAtSignup(
    refereeId: string,
    rawCode: string | null | undefined,
  ): Promise<void> {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) return;

    let settings: ReferralSettings;
    try {
      settings = await this.getSettings();
    } catch (err) {
      this.logger.warn(`activateAtSignup: failed to read settings: ${err}`);
      return;
    }

    const referrer = await this.findByCode(code);
    if (!referrer) {
      this.logger.log(`activateAtSignup: unknown code "${code}" for user ${refereeId}`);
      return;
    }
    if (referrer.id === refereeId) {
      this.logger.warn(`activateAtSignup: self-referral attempt by ${refereeId}`);
      return;
    }

    // If the program is disabled, still record the link (for audit /
    // future re-enable) but mark REJECTED so neither side gets a
    // bonus and the referrer's slot count is not consumed.
    if (!settings.enabled) {
      await this.recordRejection(referrer.id, refereeId, code, settings.bonusDays, 'program_disabled');
      return;
    }

    // Cap check — count only ACTIVATED rows so a bunch of REJECTED
    // attempts (program toggled off and on, etc.) don't burn the
    // referrer's quota.
    const activatedCount = await this.prisma.referral.count({
      where: { referrerId: referrer.id, status: 'ACTIVATED' },
    });
    if (activatedCount >= settings.maxPerReferrer) {
      await this.recordRejection(referrer.id, refereeId, code, settings.bonusDays, 'cap_reached');
      return;
    }

    // Idempotency: a referee can only ever be referred once. The
    // unique index on `referrals.refereeId` enforces this at the DB
    // level; the early-return here is just a friendlier log line.
    const existing = await this.prisma.referral.findUnique({
      where: { refereeId },
      select: { id: true },
    });
    if (existing) {
      this.logger.warn(`activateAtSignup: referee ${refereeId} already has a referral row`);
      return;
    }

    try {
      await this.grantBonusAtomically(referrer.id, refereeId, code, settings.bonusDays);
      this.logger.log(
        `Referral activated: referrer=${referrer.email} referee=${refereeId} bonus=${settings.bonusDays}d`,
      );
    } catch (err) {
      // Don't fail the signup over this. The referrer's slot is not
      // consumed because the referrals row never landed.
      this.logger.error(
        `activateAtSignup: grant failed for referrer=${referrer.id} referee=${refereeId}: ${err}`,
      );
    }
  }

  /**
   * Single transaction so we never end up with one side upgraded and
   * the other not. Each side gets either a fresh MONTHLY subscription
   * or, if they already have an ACTIVE one with an endDate in the
   * future, that subscription's endDate is pushed out by `bonusDays`.
   * The user.role is set to PREMIUM as a side effect.
   */
  private async grantBonusAtomically(
    referrerId: string,
    refereeId: string,
    code: string,
    bonusDays: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      const referrerSubId = await extendOrCreateSubscription(tx, referrerId, bonusDays);
      const refereeSubId = await extendOrCreateSubscription(tx, refereeId, bonusDays);

      await tx.user.update({
        where: { id: referrerId },
        data: { role: 'PREMIUM' },
      });
      await tx.user.update({
        where: { id: refereeId },
        data: {
          role: 'PREMIUM',
          referredById: referrerId,
          referredAt: new Date(),
        },
      });

      await tx.referral.create({
        data: {
          referrerId,
          refereeId,
          code,
          bonusDays,
          status: 'ACTIVATED',
          referrerSubscriptionId: referrerSubId,
          refereeSubscriptionId: refereeSubId,
          activatedAt: new Date(),
        },
      });
    });
  }

  private async recordRejection(
    referrerId: string,
    refereeId: string,
    code: string,
    bonusDays: number,
    reason: string,
  ): Promise<void> {
    try {
      await this.prisma.referral.create({
        data: {
          referrerId,
          refereeId,
          code,
          bonusDays,
          status: 'REJECTED',
          rejectedReason: reason,
        },
      });
      // Best-effort: still record who referred the user so the
      // admin can see the social graph even when the bonus was
      // declined.
      await this.prisma.user.update({
        where: { id: refereeId },
        data: { referredById: referrerId, referredAt: new Date() },
      });
      this.logger.log(
        `Referral rejected (${reason}): referrer=${referrerId} referee=${refereeId}`,
      );
    } catch (err) {
      this.logger.warn(`recordRejection failed: ${err}`);
    }
  }

  // ─── Read APIs (exposed via /api/referral) ─────────────────────────────

  async getStatusForUser(userId: string, baseUrl: string): Promise<ReferralStatus> {
    const settings = await this.getSettings();
    const code = await this.getOrCreateCode(userId);

    const grouped = await this.prisma.referral.groupBy({
      by: ['status'],
      where: { referrerId: userId },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const row of grouped) {
      counts[row.status as string] = (row._count as any)?._all ?? 0;
    }
    const activated = counts['ACTIVATED'] ?? 0;
    const pending = counts['PENDING'] ?? 0;
    const rejected = counts['REJECTED'] ?? 0;

    const recent = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        referee: { select: { name: true, email: true } },
      },
    });

    return {
      enabled: settings.enabled,
      bonusDays: settings.bonusDays,
      code,
      shareUrl: buildShareUrl(baseUrl, code),
      totalReferrals: activated + pending + rejected,
      activatedReferrals: activated,
      pendingReferrals: pending,
      rejectedReferrals: rejected,
      maxPerReferrer: settings.maxPerReferrer,
      remainingSlots: Math.max(0, settings.maxPerReferrer - activated),
      recent: recent.map((r: any) => ({
        refereeName: r.referee?.name ?? 'Unknown',
        refereeEmail: r.referee?.email ?? '',
        bonusDays: r.bonusDays,
        status: r.status,
        activatedAt: r.activatedAt ? r.activatedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Public preview shown on the signup page when a `?ref=…` is in the
   * URL — "Sign up via Anjali's invite and you'll both get 30 days of
   * Premium free." Returns null if the code is unknown or the program
   * is disabled, so the UI just hides the banner instead of leaking
   * enumeration data.
   */
  async previewCode(rawCode: string): Promise<{
    referrerName: string;
    bonusDays: number;
  } | null> {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) return null;

    const settings = await this.getSettings();
    if (!settings.enabled) return null;

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code },
      select: { name: true },
    });
    if (!referrer) return null;

    return {
      referrerName: referrer.name,
      bonusDays: settings.bonusDays,
    };
  }

  // ─── Admin: aggregates for the Settings tab summary card ───────────────

  async getAdminStats(): Promise<{
    totalActivated: number;
    totalRejected: number;
    totalPending: number;
    bonusDaysGranted: number;
    distinctReferrers: number;
  }> {
    const [grouped, totalDays, distinctReferrers] = await Promise.all([
      this.prisma.referral.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.referral.aggregate({
        where: { status: 'ACTIVATED' },
        _sum: { bonusDays: true },
      }),
      this.prisma.referral.findMany({
        where: { status: 'ACTIVATED' },
        distinct: ['referrerId'],
        select: { referrerId: true },
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const row of grouped) {
      counts[row.status as string] = (row._count as any)?._all ?? 0;
    }
    // Each ACTIVATED row grants the bonus to BOTH sides, so the real
    // "Premium-days handed out" total is 2× the sum of bonusDays.
    const summed = totalDays._sum?.bonusDays ?? 0;
    return {
      totalActivated: counts['ACTIVATED'] ?? 0,
      totalRejected: counts['REJECTED'] ?? 0,
      totalPending: counts['PENDING'] ?? 0,
      bonusDaysGranted: summed * 2,
      distinctReferrers: distinctReferrers.length,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return fallback;
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildShareUrl(base: string, code: string): string {
  const trimmed = (base || '').replace(/\/+$/, '');
  // The web app has no /auth/register route — the signup page is /auth, and it
  // reads the ?ref= code from there. Pointing at /auth/register 404'd every
  // shared referral link.
  return `${trimmed}/auth?ref=${encodeURIComponent(code)}`;
}

/**
 * Extend an existing ACTIVE subscription's endDate by `bonusDays`, or
 * create a fresh MONTHLY subscription if the user has none. Returns
 * the subscription id.
 *
 * "Existing ACTIVE" deliberately includes subs whose endDate is in
 * the past — we still want to push them forward rather than create a
 * second row, since the role is anyway being set to PREMIUM
 * unconditionally and the legacy expired row is otherwise harmless.
 */
async function extendOrCreateSubscription(
  tx: any,
  userId: string,
  bonusDays: number,
): Promise<string> {
  const ms = bonusDays * 24 * 60 * 60 * 1000;
  const now = new Date();

  // Prefer the latest ACTIVE row so multiple calls in the same window
  // don't fork the user across two subscriptions. We pick the row
  // with the furthest-out endDate to push from.
  const existing = await tx.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
  });

  if (existing) {
    const base =
      existing.endDate && existing.endDate.getTime() > now.getTime()
        ? existing.endDate
        : now;
    const updated = await tx.subscription.update({
      where: { id: existing.id },
      data: {
        endDate: new Date(base.getTime() + ms),
        // If the previous row was a FREE plan with no source, mark
        // it REFERRAL so the funnel views can attribute. If it was
        // already a paid sub, preserve the original source.
        source: existing.source ?? 'REFERRAL',
        plan: existing.plan === 'FREE' ? 'MONTHLY' : existing.plan,
      },
      select: { id: true },
    });
    return updated.id;
  }

  const created = await tx.subscription.create({
    data: {
      userId,
      plan: 'MONTHLY',
      status: 'ACTIVE',
      startDate: now,
      endDate: new Date(now.getTime() + ms),
      source: 'REFERRAL',
    },
    select: { id: true },
  });
  return created.id;
}

// Re-exported for tests that need to drive the same parsers.
export const __test__ = { parseBoolean, clampInt, buildShareUrl, generateCode };
