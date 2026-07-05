import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentRequiredException } from '../exceptions/payment-required.exception';

/**
 * Entitlement types that gate a one-time pay-to-unlock generation. Kept in
 * sync with the Prisma `EntitlementType` enum.
 */
export type EntitlementTypeName =
  | 'REPORT_LIFE'
  | 'REPORT_CAREER'
  | 'REPORT_MARRIAGE'
  | 'REPORT_WEALTH'
  | 'REPORT_ANNUAL'
  | 'REPORT_PALM'
  | 'PALMISTRY';

export type UnlockMode = 'subscriber' | 'entitlement';

/**
 * Central monetization gate shared by the paid features (Reports,
 * Palmistry, Chat). Encodes the two operating modes:
 *
 *  - Mode A (subscriptions disabled, default): the three paid features are
 *    pay-per-use. Reports/Palmistry require an unused one-time Entitlement;
 *    Chat keeps its credit deduction.
 *  - Mode B (subscriptions enabled): an active subscriber bypasses payment
 *    on all three; non-subscribers behave exactly as in Mode A.
 *
 * The whole policy is driven by `site_settings` so the operator can flip
 * modes and prices at runtime without a redeploy.
 */
@Injectable()
export class FeatureAccessService {
  private readonly logger = new Logger(FeatureAccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a per-feature credit cost. Admin-editable at runtime via the
   * SiteSetting `pricing.credits.<name>_cost` (Pricing tab → "Credit costs"),
   * falling back to the env-configured default when unset or invalid. Lets the
   * operator retune monetization without a redeploy. `name` is a stable slug
   * (e.g. 'chat', 'deep_dive').
   */
  async getCreditCost(name: string, fallback: number): Promise<number> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: `pricing.credits.${name}_cost` },
    });
    const n = row ? Number.parseInt(row.value, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  /**
   * Mode B is on only when the operator has flipped the flag. Default false.
   * Accepts an optional transaction client so callers running inside a
   * `$transaction` (e.g. payment settlement) read a consistent snapshot.
   */
  async subscriptionsEnabled(client: any = this.prisma): Promise<boolean> {
    const row = await client.siteSetting.findUnique({
      where: { key: 'feature.subscriptions_enabled' },
    });
    return row?.value === 'true';
  }

  /**
   * Master credit-currency switch. When ON (default — legacy behaviour) the
   * paid features deduct/charge credits as before. When OFF the app runs the
   * subscription model: deterministic features are free, the LLM deep-dive is
   * subscriber-gated, and chat/palmistry/reports are governed by per-feature
   * usage counters instead of a credit wall. Defaults to true when the setting
   * is absent so an un-migrated/un-configured deployment keeps working.
   */
  async creditsEnabled(): Promise<boolean> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: 'feature.credits_enabled' },
    });
    return row?.value !== 'false';
  }

  /**
   * Whether FREE users may buy one-time overage packs (Decision 2: "subscribe
   * first"). Default false — only active subscribers can top up; everyone else
   * is steered to subscribe. Enforced in payment `createOrder`.
   */
  async overageForFreeEnabled(): Promise<boolean> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: 'feature.overage_for_free_enabled' },
    });
    return row?.value === 'true';
  }

  /**
   * Master "make the app completely free" switch. When on, the three
   * normally-paid features (Reports, Palmistry, Chat) are free for everyone
   * — no entitlement required and no credits deducted. Default false.
   */
  async paidFeaturesFree(): Promise<boolean> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: 'feature.free_mode' },
    });
    return row?.value === 'true';
  }

  /**
   * True only when Mode B is on AND the user holds a non-expired ACTIVE
   * subscription. Mirrors the active-subscription definition used by the
   * payment webhook (status ACTIVE and endDate null or in the future).
   */
  async isActiveSubscriber(userId: string, client: any = this.prisma): Promise<boolean> {
    if (!(await this.subscriptionsEnabled(client))) return false;
    const now = new Date();
    const count = await client.subscription.count({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    });
    return count > 0;
  }

  /**
   * Decide how a Report/Palmistry generation is paid for. Returns
   * 'subscriber' when the user gets it free under Mode B, or 'entitlement'
   * when they hold an unused one-time unlock (the caller must then call
   * `consumeEntitlement` once the generated row exists). Throws 402 when
   * neither path is available so the web can launch checkout.
   *
   * Note: this only *checks* for an unused entitlement — it does not
   * consume it — so a checkout-then-generate flow can confirm access
   * before the expensive generation starts.
   */
  async resolveUnlock(userId: string, type: EntitlementTypeName): Promise<UnlockMode> {
    // Master free switch: treat as free for everyone (no entitlement spent).
    if (await this.paidFeaturesFree()) return 'subscriber';
    if (await this.isActiveSubscriber(userId)) return 'subscriber';
    const unused = await this.prisma.entitlement.count({
      where: { userId, type: type as any, consumedAt: null },
    });
    if (unused > 0) return 'entitlement';
    throw new PaymentRequiredException(
      'This feature requires a one-time purchase or an active subscription.',
    );
  }

  /**
   * Atomically spend the oldest unused entitlement of `type` for the user,
   * binding it to the generated row (`ref`). Race-safe: the guarded update
   * with `FOR UPDATE SKIP LOCKED` guarantees two concurrent generations
   * sharing a single unlock never both succeed. Throws 402 if nothing was
   * available to consume (e.g. a concurrent request won the unlock first).
   *
   * Must be called AFTER the Report/PalmistryReading row exists so a
   * failed generation never silently burns the unlock.
   */
  async consumeEntitlement(
    userId: string,
    type: EntitlementTypeName,
    ref: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `UPDATE entitlements SET "consumedAt" = NOW(), "consumedRef" = $1::uuid
       WHERE id = (
         SELECT id FROM entitlements
         WHERE "userId" = $2::uuid AND type = $3::"EntitlementType" AND "consumedAt" IS NULL
         ORDER BY "createdAt" ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id`,
      ref,
      userId,
      type,
    );
    if (!rows || rows.length === 0) {
      throw new PaymentRequiredException(
        'No unused purchase found to unlock this generation.',
      );
    }
  }

  /**
   * Un-consume the entitlement bound to a generated row (`ref`) so a paid
   * unlock is returned to the user when their generation ultimately fails.
   * Idempotent and safe to call for subscriber/free generations (no row
   * matches `consumedRef`, so it is a no-op). Returns the number of
   * entitlements restored (0 or 1).
   */
  async refundEntitlementByRef(ref: string): Promise<number> {
    const { count } = await this.prisma.entitlement.updateMany({
      where: { consumedRef: ref, consumedAt: { not: null } },
      data: { consumedAt: null, consumedRef: null },
    });
    if (count > 0) {
      this.logger.log(`Refunded ${count} entitlement(s) for failed generation ref=${ref}`);
    }
    return count;
  }

  /**
   * Void the entitlement granted for a refunded payment so a user who buys
   * a one-time unlock and is then refunded cannot still redeem it. Only
   * voids entitlements that have NOT yet been consumed (`consumedAt IS
   * NULL`) — an already-redeemed unlock is left as-is (the report/reading
   * was already delivered). We "void" by stamping `consumedAt` with a null
   * `consumedRef`, which removes it from the unused-entitlement pool
   * (`resolveUnlock`/`consumeEntitlement` both filter `consumedAt IS NULL`)
   * without needing a schema migration. Idempotent. Returns the count voided.
   *
   * Accepts an optional transaction client so it runs inside the refund's
   * atomic claim.
   */
  async voidEntitlementByPayment(paymentId: string, tx?: any): Promise<number> {
    const client = tx ?? this.prisma;
    const { count } = await client.entitlement.updateMany({
      where: { paymentId, consumedAt: null },
      data: { consumedAt: new Date(), consumedRef: null },
    });
    if (count > 0) {
      this.logger.log(`Voided ${count} entitlement(s) for refunded payment ${paymentId}`);
    }
    return count;
  }

  /**
   * Grant a one-time entitlement for a successful payment. Idempotent: the
   * unique `paymentId` constraint means a verify + webhook double-fire
   * grants exactly one unlock (the second hits P2002 and is treated as
   * already-granted). Returns true when a new grant was created.
   *
   * Accepts an optional transaction client so it can run inside the
   * payment's atomic claim.
   */
  async grantEntitlement(
    userId: string,
    paymentId: string,
    type: EntitlementTypeName,
    tx?: any,
  ): Promise<boolean> {
    const client = tx ?? this.prisma;
    try {
      await client.entitlement.create({
        data: { userId, paymentId, type: type as any },
      });
      return true;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Already granted for this payment — idempotent no-op.
        return false;
      }
      throw err;
    }
  }

  // ─── Usage metering (subscription model) ───────────────────────────────────
  // Per-feature counters used when credits are off. Free-tier allowances are
  // LIFETIME (a fixed period key, never reset); subscriber allowances are keyed
  // by calendar month so a new month is a fresh row — no reset cron required.

  /** Built-in fallbacks when a `limits.<feature>.<tier>` setting is absent. */
  private static readonly DEFAULT_LIMITS: Record<string, { free: number; subscriber: number }> = {
    chat: { free: 50, subscriber: 1000 },
    palmistry: { free: 2, subscriber: 4 },
    // Reports are metered per type (counter feature `report_<type>`) against a
    // shared limit key `report`, so a subscriber gets one of EACH type per
    // period — i.e. a full "set", not one report total.
    report: { free: 1, subscriber: 1 },
  };

  /** UTC calendar-month key, e.g. "2026-06". A new month rolls the counter. */
  private monthKey(d = new Date()): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Counter period key: subscribers meter per month, free users for life. */
  private periodKeyFor(isSubscriber: boolean): string {
    return isSubscriber ? this.monthKey() : 'LIFETIME';
  }

  /**
   * Resolve the admin-tunable allowance for a feature/tier from
   * `limits.<feature>.<free|subscriber>`, falling back to the built-in default
   * when the setting is unset or malformed.
   */
  async getUsageLimit(feature: string, isSubscriber: boolean): Promise<number> {
    const tier = isSubscriber ? 'subscriber' : 'free';
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: `limits.${feature}.${tier}` },
    });
    const n = row ? Number.parseInt(row.value, 10) : NaN;
    if (Number.isFinite(n) && n >= 0) return n;
    return FeatureAccessService.DEFAULT_LIMITS[feature]?.[tier] ?? 0;
  }

  /**
   * Decide whether `userId` may use one more unit of `feature` under the
   * subscription model. Returns the current usage snapshot so callers can
   * surface "X left" and pick the right paywall copy. Does NOT mutate — the
   * caller increments only after the unit is actually delivered.
   */
  async checkUsage(
    userId: string,
    feature: string,
    /**
     * Key the allowance is read under, when it differs from the counter
     * `feature`. Reports meter per type (`report_life`, `report_career`, …) but
     * share one limit (`report`), so callers pass `limitFeature='report'`.
     * Defaults to `feature`.
     */
    limitFeature: string = feature,
  ): Promise<{
    allowed: boolean;
    used: number;
    bonus: number;
    limit: number;
    remaining: number;
    isSubscriber: boolean;
    periodKey: string;
  }> {
    const isSubscriber = await this.isActiveSubscriber(userId);
    const periodKey = this.periodKeyFor(isSubscriber);
    const limit = await this.getUsageLimit(limitFeature, isSubscriber);
    const counter = await this.prisma.usageCounter.findUnique({
      where: { userId_feature_periodKey: { userId, feature, periodKey } },
    });
    const used = counter?.used ?? 0;
    const bonus = counter?.bonus ?? 0;
    const ceiling = limit + bonus;
    const remaining = Math.max(0, ceiling - used);
    return { allowed: used < ceiling, used, bonus, limit, remaining, isSubscriber, periodKey };
  }

  /**
   * Record one consumed unit. Upsert keeps the row creation race-safe; the
   * unique (userId, feature, periodKey) constraint collapses concurrent first
   * uses to a single row. Pass the `periodKey` from the matching `checkUsage`
   * so a month boundary crossed mid-request can't split the count.
   */
  async incrementUsage(userId: string, feature: string, periodKey: string): Promise<void> {
    await this.prisma.usageCounter.upsert({
      where: { userId_feature_periodKey: { userId, feature, periodKey } },
      create: { userId, feature, periodKey, used: 1 },
      update: { used: { increment: 1 } },
    });
  }

  /**
   * Atomically CLAIM one metered unit: increment `used` only if it is still
   * below the ceiling (limit + bonus), in a single guarded UPDATE. This is the
   * race-safe replacement for the check-then-increment sequence (`checkUsage`
   * then `incrementUsage`), which let N concurrent requests all pass the read
   * and all get served. Callers should claim BEFORE delivering the unit and give
   * it back via `decrementUsage` if delivery ultimately fails.
   *
   * Returns `allowed:false` (claiming nothing) when already at/over the ceiling.
   */
  async tryConsumeUsage(
    userId: string,
    feature: string,
    limitFeature: string = feature,
  ): Promise<{
    allowed: boolean;
    used: number;
    bonus: number;
    limit: number;
    remaining: number;
    isSubscriber: boolean;
    periodKey: string;
  }> {
    const isSubscriber = await this.isActiveSubscriber(userId);
    const periodKey = this.periodKeyFor(isSubscriber);
    const limit = await this.getUsageLimit(limitFeature, isSubscriber);

    // Ensure the counter row exists first (Prisma manages id/updatedAt/createdAt
    // and the unique constraint collapses concurrent first-inserts to one row),
    // so the guarded claim below is a pure UPDATE with no INSERT-default concerns.
    await this.prisma.usageCounter.upsert({
      where: { userId_feature_periodKey: { userId, feature, periodKey } },
      create: { userId, feature, periodKey, used: 0 },
      update: {},
    });

    // Single atomic guard: only one of N concurrent requests can move `used`
    // from ceiling-1 to ceiling.
    const rows = await this.prisma.$queryRawUnsafe<{ used: number; bonus: number }[]>(
      `UPDATE usage_counters
         SET used = used + 1, "updatedAt" = NOW()
         WHERE "userId" = $1::uuid AND feature = $2 AND "periodKey" = $3
           AND used < ($4::int + bonus)
         RETURNING used, bonus`,
      userId,
      feature,
      periodKey,
      limit,
    );

    if (rows.length > 0) {
      const { used, bonus } = rows[0];
      return { allowed: true, used, bonus, limit, remaining: Math.max(0, limit + bonus - used), isSubscriber, periodKey };
    }
    // At/over ceiling — nothing claimed. Return the current snapshot.
    const snap = await this.checkUsage(userId, feature, limitFeature);
    return { ...snap, allowed: false };
  }

  /**
   * Give back one metered unit, e.g. when an async (queued) palmistry/report
   * generation ultimately fails after the unit was counted at enqueue — the
   * mirror of refundEntitlementByRef for the subscription model. Floors at 0
   * via the `used > 0` guard, and is a safe no-op when no counter row exists.
   */
  async decrementUsage(userId: string, feature: string, periodKey: string): Promise<void> {
    await this.prisma.usageCounter.updateMany({
      where: { userId, feature, periodKey, used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    });
  }

  /**
   * Top up the current period's allowance by `count` units (a purchased
   * overage pack). Bonus lives on the same row as `used`, so it is consumed
   * within the current month for subscribers and expires when the period rolls.
   * Returns the period key the bonus was applied to.
   */
  async addUsageBonus(userId: string, feature: string, count: number, tx?: any): Promise<string> {
    const client = tx ?? this.prisma;
    // Read subscriber status on the SAME client so a settlement transaction
    // picks the period key from a consistent snapshot.
    const isSubscriber = await this.isActiveSubscriber(userId, client);
    const periodKey = this.periodKeyFor(isSubscriber);
    await client.usageCounter.upsert({
      where: { userId_feature_periodKey: { userId, feature, periodKey } },
      create: { userId, feature, periodKey, bonus: count },
      update: { bonus: { increment: count } },
    });
    return periodKey;
  }

  /**
   * Reverse a previously-granted usage bonus (e.g. a refunded overage pack).
   * Only reduces an EXISTING bonus and floors at 0 — never creates a row or
   * drives the bonus negative, so a pack whose period already rolled (and thus
   * has nothing left to reverse) is a safe no-op. Mirrors addUsageBonus's
   * period-key resolution so it targets the same counter row.
   */
  async removeUsageBonus(userId: string, feature: string, count: number, tx?: any): Promise<void> {
    const client = tx ?? this.prisma;
    const isSubscriber = await this.isActiveSubscriber(userId, client);
    const periodKey = this.periodKeyFor(isSubscriber);
    const row = await client.usageCounter.findUnique({
      where: { userId_feature_periodKey: { userId, feature, periodKey } },
      select: { bonus: true },
    });
    const dec = Math.min(count, row?.bonus ?? 0);
    if (dec > 0) {
      await client.usageCounter.update({
        where: { userId_feature_periodKey: { userId, feature, periodKey } },
        data: { bonus: { decrement: dec } },
      });
    }
  }
}
