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

  /** Mode B is on only when the operator has flipped the flag. Default false. */
  async subscriptionsEnabled(): Promise<boolean> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: 'feature.subscriptions_enabled' },
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
  async isActiveSubscriber(userId: string): Promise<boolean> {
    if (!(await this.subscriptionsEnabled())) return false;
    const now = new Date();
    const count = await this.prisma.subscription.count({
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
}
