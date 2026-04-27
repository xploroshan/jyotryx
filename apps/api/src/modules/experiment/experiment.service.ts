import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface PaywallAssignment {
  experiment: 'paywall_v1';
  variant: 'control' | 'first_free';
  /** True only the first time a key is seen — the web layer uses this
   *  to decide whether to set the cookie. Subsequent calls return the
   *  same variant with `created=false`. */
  created: boolean;
}

export interface ExperimentStats {
  experiment: string;
  enabled: boolean;
  variants: Array<{
    variant: string;
    weight: number;
    assignments: number;
    conversions: number;
    conversionRate: number;
  }>;
  totalAssignments: number;
  totalConversions: number;
}

const PAYWALL_EXPERIMENT = 'paywall_v1';
const VALID_PAYWALL_VARIANTS = ['control', 'first_free'] as const;
type PaywallVariant = (typeof VALID_PAYWALL_VARIANTS)[number];

/**
 * Lightweight experiment / A-B-test runtime.
 *
 * Why DIY instead of GrowthBook / Statsig:
 *   - We need exactly one experiment (paywall) at MVP scope.
 *   - The bucket store is a single Postgres table and reuses the
 *     existing Prisma stack; no new vendor, no new auth.
 *   - Variants and weights live in `site_settings` so the admin can
 *     re-balance traffic from the dashboard without a redeploy.
 *
 * Sticky assignment: a key (auth user id OR an anonymous-cookie value
 * minted by the web layer) is bucketed exactly once. A subsequent
 * call with the same key always returns the same variant — even if
 * the operator has since changed the weights — because we read from
 * the persisted assignment row.
 *
 * Hashing: we hash `experiment:userKey` with SHA-256 and take the
 * lowest 16 bits as a 0..65535 number. This is fast, deterministic,
 * and dependency-free. The cumulative weight check picks a variant.
 */
@Injectable()
export class ExperimentService {
  private readonly logger = new Logger(ExperimentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings (admin-tunable) ──────────────────────────────────────────

  async getPaywallSettings(): Promise<{
    enabled: boolean;
    experimentId: string;
    weights: Record<PaywallVariant, number>;
  }> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'paywall.' } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const weights: Record<PaywallVariant, number> = {
      control: clampWeight(map['paywall.variant.control.weight'], 50),
      first_free: clampWeight(map['paywall.variant.first_free.weight'], 50),
    };
    return {
      enabled: parseBool(map['paywall.experiment_enabled'], true),
      experimentId: map['paywall.experiment_id'] || PAYWALL_EXPERIMENT,
      weights,
    };
  }

  // ─── Assignment ────────────────────────────────────────────────────────

  /**
   * Get or create the paywall variant for `userKey`.
   *
   * `userKey` is whatever stable identifier the caller has. The web
   * layer sends the authenticated user id when present, otherwise a
   * 32-char anonymous cookie value. We don't care which — only that
   * a return-visit user always lands on the same variant.
   */
  async assignPaywall(
    userKey: string,
    opts: { isAuthenticated?: boolean; userId?: string | null } = {},
  ): Promise<PaywallAssignment> {
    const settings = await this.getPaywallSettings();
    if (!settings.enabled) {
      // Experiment off → everyone gets control. Don't persist.
      return { experiment: PAYWALL_EXPERIMENT, variant: 'control', created: false };
    }

    const existing = await this.prisma.experimentAssignment.findUnique({
      where: { experiment_userKey: { experiment: PAYWALL_EXPERIMENT, userKey } },
      select: { variant: true },
    });
    if (existing) {
      return {
        experiment: PAYWALL_EXPERIMENT,
        variant: coerceVariant(existing.variant),
        created: false,
      };
    }

    const variant = pickVariant(PAYWALL_EXPERIMENT, userKey, settings.weights);
    try {
      await this.prisma.experimentAssignment.create({
        data: {
          experiment: PAYWALL_EXPERIMENT,
          userKey,
          variant,
          isAuthenticated: !!opts.isAuthenticated,
          userId: opts.userId ?? null,
        },
      });
    } catch (err: any) {
      // Race: another request bucketed the same key first. Re-read so
      // both callers see the same answer.
      if (err?.code === 'P2002') {
        const row = await this.prisma.experimentAssignment.findUnique({
          where: { experiment_userKey: { experiment: PAYWALL_EXPERIMENT, userKey } },
          select: { variant: true },
        });
        if (row) {
          return {
            experiment: PAYWALL_EXPERIMENT,
            variant: coerceVariant(row.variant),
            created: false,
          };
        }
      }
      this.logger.warn(`assignPaywall: persist failed for key=${userKey}: ${err?.message ?? err}`);
    }

    return { experiment: PAYWALL_EXPERIMENT, variant, created: true };
  }

  /**
   * Mark the assignment as converted. Called from the success paths we
   * care about (signup, first paid kundli, first subscription).
   *
   * Idempotent — if `convertedAt` is already set, we leave it alone so
   * the first conversion timestamp is preserved.
   */
  async recordConversion(
    userKey: string,
    conversionType: 'signup' | 'first_paid_kundli' | 'subscription',
  ): Promise<{ updated: boolean }> {
    try {
      const result = await this.prisma.experimentAssignment.updateMany({
        where: {
          experiment: PAYWALL_EXPERIMENT,
          userKey,
          convertedAt: null,
        },
        data: {
          convertedAt: new Date(),
          conversionType,
        },
      });
      return { updated: result.count > 0 };
    } catch (err) {
      this.logger.warn(`recordConversion: ${(err as Error)?.message ?? err}`);
      return { updated: false };
    }
  }

  /**
   * Promote an anonymous-cookie assignment to a real user id when the
   * cookie-bucketed visitor signs up. Without this the funnel splits
   * the same human into two rows.
   */
  async linkAuthUser(userKey: string, userId: string): Promise<void> {
    try {
      await this.prisma.experimentAssignment.updateMany({
        where: {
          experiment: PAYWALL_EXPERIMENT,
          userKey,
          userId: null,
        },
        data: {
          userId,
          isAuthenticated: true,
        },
      });
    } catch (err) {
      this.logger.warn(`linkAuthUser: ${(err as Error)?.message ?? err}`);
    }
  }

  /**
   * Behavioural side of the paywall A/B test.
   *
   * Returns true when:
   *   1. The experiment is enabled (admin can flip it off)
   *   2. The user is in the `first_free` arm (sticky, persisted)
   *   3. The user has zero prior `kundli_charts` rows
   *
   * Callers (currently `AstrologyService.generateKundli`) use this to
   * decide whether to deduct credits for the request. A shared helper
   * keeps the rule in one place — when matching/tarot/etc. join the
   * same A/B later, this method grows a `kind` parameter rather than
   * the rule scattering across services.
   *
   * Soft-fails to `false` on any error so an experiment glitch never
   * accidentally hands out free credits to everyone.
   */
  async shouldGrantFreeFirstKundli(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const settings = await this.getPaywallSettings();
      if (!settings.enabled) return false;

      const userKey = `u:${userId}`;
      const assignment = await this.prisma.experimentAssignment.findUnique({
        where: { experiment_userKey: { experiment: PAYWALL_EXPERIMENT, userKey } },
        select: { variant: true },
      });
      if (!assignment || coerceVariant(assignment.variant) !== 'first_free') return false;

      // First kundli only — the rule is "first one is on us", not a
      // recurring discount. Counting a single row is one indexed
      // hit on (kundli_charts.userId).
      const priorKundlis = await this.prisma.kundliChart.count({
        where: { userId },
      });
      return priorKundlis === 0;
    } catch (err) {
      this.logger.warn(
        `shouldGrantFreeFirstKundli: failing closed for user=${userId}: ${(err as Error)?.message ?? err}`,
      );
      return false;
    }
  }

  // ─── Admin ─────────────────────────────────────────────────────────────

  async getStats(): Promise<ExperimentStats> {
    const settings = await this.getPaywallSettings();
    const grouped = await this.prisma.experimentAssignment.groupBy({
      by: ['variant'],
      where: { experiment: PAYWALL_EXPERIMENT },
      _count: { _all: true },
    });
    const converted = await this.prisma.experimentAssignment.groupBy({
      by: ['variant'],
      where: { experiment: PAYWALL_EXPERIMENT, convertedAt: { not: null } },
      _count: { _all: true },
    });
    const cnt = mapCount(grouped);
    const cvr = mapCount(converted);

    const variants = (Object.keys(settings.weights) as PaywallVariant[]).map((v) => {
      const a = cnt[v] ?? 0;
      const c = cvr[v] ?? 0;
      return {
        variant: v,
        weight: settings.weights[v],
        assignments: a,
        conversions: c,
        conversionRate: a === 0 ? 0 : Math.round((c / a) * 10_000) / 100, // 2 dp percent
      };
    });

    return {
      experiment: PAYWALL_EXPERIMENT,
      enabled: settings.enabled,
      variants,
      totalAssignments: variants.reduce((s, v) => s + v.assignments, 0),
      totalConversions: variants.reduce((s, v) => s + v.conversions, 0),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function pickVariant(
  experiment: string,
  userKey: string,
  weights: Record<PaywallVariant, number>,
): PaywallVariant {
  const total = Object.values(weights).reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return 'control'; // misconfiguration; fall back
  const bucket = hashBucket(`${experiment}:${userKey}`, total);
  let cumulative = 0;
  for (const v of VALID_PAYWALL_VARIANTS) {
    cumulative += Math.max(0, weights[v]);
    if (bucket < cumulative) return v;
  }
  return 'control';
}

function hashBucket(seed: string, modulo: number): number {
  const h = crypto.createHash('sha256').update(seed).digest();
  // Take the first 4 bytes as a u32, mod into the weight space.
  const u32 = h.readUInt32BE(0);
  return u32 % modulo;
}

function clampWeight(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return fallback;
}

function coerceVariant(v: string): PaywallVariant {
  return (VALID_PAYWALL_VARIANTS as readonly string[]).includes(v)
    ? (v as PaywallVariant)
    : 'control';
}

function mapCount(rows: Array<{ variant: string; _count: any }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.variant] = row._count?._all ?? 0;
  }
  return out;
}

export const __test__ = { pickVariant, hashBucket, clampWeight, parseBool };
