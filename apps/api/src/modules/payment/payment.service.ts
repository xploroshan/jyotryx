import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { CreateOrderDto, VerifyPaymentDto, CreateSubscriptionDto } from './dto';

/**
 * Constant-time HMAC-signature comparison. Razorpay signatures are hex
 * strings of fixed length (64 chars for SHA-256), but we defensively
 * bail on length mismatch before calling `timingSafeEqual` (which itself
 * throws on unequal-length buffers).
 */
function safeSignatureEqual(expected: string, actual: string | undefined): boolean {
  if (!actual || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string;
  createdAt: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  paymentId: string;
  orderId: string;
  creditsAdded?: number;
}

export interface SubscriptionResult {
  id: string;
  planId: string;
  status: string;
  currentStart: string;
  currentEnd: string;
  /** Razorpay-hosted checkout URL the client redirects to in order to
   *  authorise the first charge. Undefined in mock mode (no credentials). */
  shortUrl?: string;
}

export interface PaymentHistoryItem {
  id: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private razorpayInstance: any = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
  ) {
    this.initRazorpay();
  }

  private initRazorpay(): void {
    const keyId = this.configService.get<string>('razorpay.keyId');
    const keySecret = this.configService.get<string>('razorpay.keySecret');

    if (keyId && keySecret) {
      try {
        const Razorpay = require('razorpay');
        this.razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
        this.logger.log('Razorpay initialized successfully');
      } catch {
        this.logger.warn('Razorpay initialization failed, using mock mode');
      }
    } else {
      this.logger.warn('Razorpay credentials not configured, using mock mode');
    }
  }

  private getExpectedPrice(productId: string): number | null {
    const prices: Record<string, number> = {
      'credits_10': 9900,    // 99 INR in paise
      'credits_50': 39900,   // 399 INR
      'credits_100': 69900,  // 699 INR
      'report_life': 59900,
      'report_career': 59900,
      'report_marriage': 59900,
      'report_wealth': 59900,
      'report_palm': 19900,
      'report_annual': 99900,
      'palm_reading': 19900,
    };
    return prices[productId] ?? null;
  }

  /**
   * Resolve a credit pack (starter / popular / pro …) from the
   * admin-editable SiteSettings — the SAME source the web /pricing page
   * reads. This is the single source of truth for both the price the
   * client must pay and the number of credits we grant, so the two can
   * never drift: a pack advertised as "25 credits for ₹99" charges ₹99
   * and grants exactly 25.
   *
   * `productId` arrives as `credits_<packId>` (e.g. `credits_starter`);
   * the leading `credits_`/`credits.` is stripped before lookup. Returns
   * null for unknown packs or malformed/missing settings so the caller
   * can fall back to legacy product handling.
   */
  private async resolveCreditPack(
    productId: string,
  ): Promise<{ packId: string; priceINR: number; credits: number } | null> {
    const packId = productId.replace(/^credits[_.]/i, '');
    if (!/^[a-z0-9_]+$/i.test(packId)) return null;

    const priceKey = `pricing.credits.${packId}.price`;
    const creditsKey = `pricing.credits.${packId}.credits`;
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { in: [priceKey, creditsKey] } },
    });
    const byKey: Record<string, string> = {};
    for (const row of rows) byKey[row.key] = row.value;

    const priceINR = parseInt(byKey[priceKey], 10);
    const credits = parseInt(byKey[creditsKey], 10);
    if (
      !Number.isFinite(priceINR) ||
      !Number.isFinite(credits) ||
      priceINR <= 0 ||
      credits <= 0
    ) {
      return null;
    }
    return { packId, priceINR, credits };
  }

  async createOrder(userId: string, dto: CreateOrderDto): Promise<RazorpayOrder> {
    this.logger.log(`Creating order for user: ${userId}, amount: ${dto.amount}`);

    // Resolve how many credits this purchase grants, and validate the
    // amount, against the authoritative price. Credit packs are looked up
    // in SiteSettings; everything else falls back to the static price map.
    let grantedCredits: number | undefined;
    if (dto.productId) {
      const pack = await this.resolveCreditPack(dto.productId);
      if (pack) {
        const expectedPaise = pack.priceINR * 100;
        if (dto.amount !== expectedPaise) {
          throw new BadRequestException(
            `Invalid amount for ${dto.productId}. Expected ${expectedPaise}, got ${dto.amount}`,
          );
        }
        grantedCredits = pack.credits;
      } else {
        const expectedPrice = this.getExpectedPrice(dto.productId);
        if (expectedPrice !== null && dto.amount !== expectedPrice) {
          throw new BadRequestException(`Invalid amount for product ${dto.productId}. Expected ${expectedPrice}, got ${dto.amount}`);
        }
      }
    }

    let orderId: string;
    let orderAmount = dto.amount;
    let orderCurrency = dto.currency || 'INR';

    if (this.razorpayInstance) {
      try {
        const order = await this.razorpayInstance.orders.create({
          amount: dto.amount,
          currency: dto.currency || 'INR',
          receipt: `rcpt_${crypto.randomUUID().substring(0, 8)}`,
          notes: { userId, productId: dto.productId, description: dto.description || '' },
        });
        orderId = order.id;
        orderAmount = order.amount;
        orderCurrency = order.currency;
      } catch (error) {
        this.logger.error('Razorpay order creation failed', error);
        throw new InternalServerErrorException('Failed to create payment order');
      }
    } else {
      orderId = `order_mock_${crypto.randomUUID().substring(0, 14)}`;
    }

    // Persist to DB
    await this.prisma.payment.create({
      data: {
        userId,
        amount: orderAmount / 100, // Convert paise to rupees
        currency: orderCurrency,
        status: 'PENDING',
        razorpayOrderId: orderId,
        type: 'CREDITS',
        // `credits` is captured at order-creation time from the
        // authoritative pack definition, so the grant on verify/webhook
        // is deterministic and never re-derived from the amount.
        metadata: { productId: dto.productId, description: dto.description, credits: grantedCredits },
      },
    });

    return {
      id: orderId,
      entity: 'order',
      amount: orderAmount,
      currency: orderCurrency,
      status: 'created',
      receipt: `rcpt_${crypto.randomUUID().substring(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto): Promise<PaymentVerificationResult> {
    this.logger.log(`Verifying payment for user: ${userId}, order: ${dto.razorpayOrderId}`);

    // Signature verification — fail-CLOSED when no secret is configured.
    // Previous behaviour fell through if both `razorpay.webhookSecret` and
    // `razorpay.keySecret` were missing; that turned the verification
    // endpoint into a free credit faucet on a misconfigured deploy.
    const webhookSecret = this.configService.get<string>('razorpay.webhookSecret')
                       || this.configService.get<string>('razorpay.keySecret');
    if (!webhookSecret) {
      this.logger.error('verifyPayment: no Razorpay secret configured — refusing to verify');
      throw new InternalServerErrorException('Payment verification is not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    // Constant-time comparison. Plain `!==` short-circuits on the first
    // differing byte which leaks a timing side channel — a classic HMAC
    // verification bug. timingSafeEqual requires equal-length buffers;
    // the length check is still branchy but gives no useful signal.
    if (!safeSignatureEqual(expectedSignature, dto.razorpaySignature)) {
      throw new BadRequestException('Payment verification failed: invalid signature');
    }

    // Claim the payment atomically: updateMany with `status != SUCCESS`
    // guard in the WHERE clause. Returns count=1 only for the caller that
    // actually transitioned the row; concurrent duplicates (client retry
    // OR client-verify + server-webhook racing) see count=0 and skip the
    // credit grant. Prevents double-credit bugs.
    const { count } = await this.prisma.payment.updateMany({
      where: {
        razorpayOrderId: dto.razorpayOrderId,
        userId,
        status: { not: 'SUCCESS' },
      },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId: dto.razorpayPaymentId,
      },
    });

    if (count === 0) {
      // Either the order doesn't exist for this user, or another call
      // already claimed it (idempotent success from the user's POV).
      const existing = await this.prisma.payment.findFirst({
        where: { razorpayOrderId: dto.razorpayOrderId, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new BadRequestException('Payment record not found for this order');
      }
      return {
        verified: true,
        paymentId: dto.razorpayPaymentId,
        orderId: dto.razorpayOrderId,
        creditsAdded: 0,
      };
    }

    // We won the update — safe to grant credits exactly once.
    const payment = await this.prisma.payment.findFirstOrThrow({
      where: { razorpayOrderId: dto.razorpayOrderId, userId },
      select: { amount: true, metadata: true },
    });
    const creditsToAdd = this.creditsForPayment(payment);
    await this.userService.addCredits(userId, creditsToAdd, 'PURCHASE', `Purchased ${creditsToAdd} credits`);

    return {
      verified: true,
      paymentId: dto.razorpayPaymentId,
      orderId: dto.razorpayOrderId,
      creditsAdded: creditsToAdd,
    };
  }

  async createSubscription(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResult> {
    const isAnnual = dto.plan.toUpperCase() === 'ANNUAL';
    this.logger.log(`Creating subscription for user: ${userId}, plan: ${dto.plan}`);

    // Map the logical tier to a real Razorpay plan_id configured out of
    // band (dashboard → env). The client never supplies a raw plan_id, so
    // it can't subscribe itself to an arbitrary/cheaper plan.
    const razorpayPlanId = isAnnual
      ? this.configService.get<string>('razorpay.planAnnual')
      : this.configService.get<string>('razorpay.planMonthly');

    let subscriptionId: string;
    let shortUrl: string | undefined;

    if (this.razorpayInstance) {
      if (!razorpayPlanId) {
        this.logger.error(`No Razorpay plan_id configured for ${isAnnual ? 'ANNUAL' : 'MONTHLY'}`);
        throw new InternalServerErrorException('Subscription plan is not configured');
      }
      try {
        const subscription = await this.razorpayInstance.subscriptions.create({
          plan_id: razorpayPlanId,
          total_count: dto.totalCount ? parseInt(dto.totalCount) : isAnnual ? 5 : 12,
          notes: { userId },
        });
        subscriptionId = subscription.id;
        shortUrl = subscription.short_url;
      } catch (error) {
        this.logger.error('Razorpay subscription creation failed', error);
        throw new InternalServerErrorException('Failed to create subscription');
      }
    } else {
      subscriptionId = `sub_mock_${crypto.randomUUID().substring(0, 14)}`;
    }

    // Persist the subscription. We do NOT grant the PREMIUM role here in
    // live mode: the Razorpay-hosted checkout (short_url) hasn't charged
    // the customer yet, so granting Premium on creation would hand free
    // access to anyone who opens — then abandons — the checkout. The role
    // is granted from the subscription.activated / subscription.charged
    // webhook once the first payment is captured.
    //
    // In mock mode (no Razorpay credentials) there is no webhook to fire,
    // so we grant immediately to keep local development usable.
    const endDate = new Date(Date.now() + (isAnnual ? 365 : 30) * 24 * 60 * 60 * 1000);
    const grantImmediately = !this.razorpayInstance;
    await this.prisma.$transaction(async (tx: any) => {
      await tx.subscription.create({
        data: {
          userId,
          plan: isAnnual ? 'ANNUAL' : 'MONTHLY',
          status: 'ACTIVE',
          razorpaySubscriptionId: subscriptionId,
          endDate,
        },
      });

      if (grantImmediately) {
        await tx.user.update({
          where: { id: userId },
          data: { role: 'PREMIUM' },
        });
      }
    });

    return {
      id: subscriptionId,
      planId: razorpayPlanId || (isAnnual ? 'ANNUAL' : 'MONTHLY'),
      status: 'active',
      currentStart: new Date().toISOString(),
      currentEnd: endDate.toISOString(),
      shortUrl,
    };
  }

  async handleWebhook(payload: Record<string, any>, signatureHeader?: string): Promise<{ received: boolean }> {
    // Signature verification — fail-CLOSED when secret missing (same as
    // verifyPayment). A webhook endpoint with no signature check is a
    // public credit-grant API; refuse to run without configuration.
    const webhookSecret = this.configService.get<string>('razorpay.webhookSecret') ||
                          this.configService.get<string>('razorpay.keySecret');
    if (!webhookSecret) {
      this.logger.error('handleWebhook: no Razorpay secret configured — refusing to process');
      throw new InternalServerErrorException('Webhook processing is not configured');
    }
    if (!signatureHeader) {
      this.logger.warn('Webhook received without signature header - rejecting');
      throw new BadRequestException('Missing webhook signature');
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (!safeSignatureEqual(expectedSignature, signatureHeader)) {
      this.logger.warn('Webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Webhook received: ${payload?.event || 'unknown event'}`);

    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;

    try {
      switch (event) {
        case 'payment.captured':
          if (paymentEntity?.order_id) {
            await this.prisma.$transaction(async (tx: any) => {
              // Claim the payment atomically: updateMany with the
              // status guard in WHERE. Without this, a concurrent
              // client-side verify + webhook can both pass the
              // status check and double-grant credits (same race as
              // verifyPayment before the fix).
              const { count } = await tx.payment.updateMany({
                where: {
                  razorpayOrderId: paymentEntity.order_id,
                  status: { not: 'SUCCESS' },
                },
                data: { status: 'SUCCESS', razorpayPaymentId: paymentEntity.id },
              });
              if (count === 0) return; // lost the race or not our order
              const payment = await tx.payment.findFirstOrThrow({
                where: { razorpayOrderId: paymentEntity.order_id },
                select: { userId: true, amount: true, metadata: true },
              });
              const creditsToAdd = this.creditsForPayment(payment);
              await tx.user.update({
                where: { id: payment.userId },
                data: { credits: { increment: creditsToAdd } },
              });
              await tx.creditTransaction.create({
                data: {
                  userId: payment.userId,
                  amount: creditsToAdd,
                  type: 'PURCHASE',
                  description: `Webhook: purchased ${creditsToAdd} credits`,
                },
              });
            });
          }
          break;
        case 'payment.failed':
          if (paymentEntity?.order_id) {
            await this.prisma.payment.updateMany({
              where: { razorpayOrderId: paymentEntity.order_id },
              data: { status: 'FAILED' },
            });
          }
          break;
        case 'subscription.activated':
        case 'subscription.charged': {
          // First (and recurring) successful charge. THIS is where Premium
          // is granted — not at subscription creation — so an authorised
          // payment is what unlocks access. Idempotent: re-grants the role
          // on every renewal charge, which is a no-op if already PREMIUM,
          // and rolls the local endDate forward to the new period end.
          const subEntity = payload?.payload?.subscription?.entity;
          if (subEntity?.id) {
            const currentEnd =
              typeof subEntity.current_end === 'number'
                ? new Date(subEntity.current_end * 1000)
                : null;
            await this.prisma.$transaction(async (tx: any) => {
              const { count } = await tx.subscription.updateMany({
                where: { razorpaySubscriptionId: subEntity.id },
                data: { status: 'ACTIVE', ...(currentEnd ? { endDate: currentEnd } : {}) },
              });
              if (count === 0) return; // not one of our subscriptions
              const sub = await tx.subscription.findFirst({
                where: { razorpaySubscriptionId: subEntity.id },
                select: { userId: true },
              });
              if (sub) {
                await tx.user.update({
                  where: { id: sub.userId },
                  data: { role: 'PREMIUM' },
                });
              }
            });
          }
          break;
        }
        case 'subscription.cancelled':
        case 'subscription.halted':
        case 'subscription.completed': {
          // Terminal states: cancelled by the user, halted after repeated
          // failed renewal charges, or completed (total_count reached). In
          // every case the subscription no longer entitles the user to
          // Premium, so we mark it terminal AND revoke the role — previously
          // only the status was updated, which left lapsed/cancelled
          // subscribers with Premium access indefinitely.
          const subEntity = payload?.payload?.subscription?.entity;
          if (subEntity?.id) {
            const newStatus = event === 'subscription.cancelled' ? 'CANCELLED' : 'EXPIRED';
            await this.prisma.$transaction(async (tx: any) => {
              const { count } = await tx.subscription.updateMany({
                where: { razorpaySubscriptionId: subEntity.id },
                data: { status: newStatus },
              });
              if (count === 0) return; // not one of our subscriptions
              const sub = await tx.subscription.findFirst({
                where: { razorpaySubscriptionId: subEntity.id },
                select: { userId: true },
              });
              if (sub) await this.revokePremiumIfNoActiveSub(tx, sub.userId);
            });
          }
          break;
        }
        case 'refund.created':
        case 'refund.processed': {
          // Razorpay refunded a captured payment (full or partial). Mark the
          // payment REFUNDED and, for credit purchases, claw back the granted
          // credits so a refunded user can't keep spending what they were
          // reimbursed for. We clamp the deduction at the current balance so
          // the wallet never goes negative (the user may have already spent
          // some), and log a negative-amount PURCHASE transaction for the
          // audit trail — CreditTransactionType has no dedicated REFUND value,
          // so a signed PURCHASE keeps the ledger balanced without a schema
          // migration. Idempotent: the status guard means a redelivered
          // refund webhook claims nothing and reverses no further credits.
          const refund = payload?.payload?.refund?.entity;
          if (refund?.payment_id) {
            await this.prisma.$transaction(async (tx: any) => {
              const { count } = await tx.payment.updateMany({
                where: { razorpayPaymentId: refund.payment_id, status: 'SUCCESS' },
                data: { status: 'REFUNDED' },
              });
              if (count === 0) return; // already refunded, or not our payment
              const payment = await tx.payment.findFirst({
                where: { razorpayPaymentId: refund.payment_id },
                select: { userId: true, amount: true, metadata: true, type: true },
              });
              if (!payment || payment.type !== 'CREDITS') return;
              const granted = this.creditsForPayment(payment);
              if (granted <= 0) return;
              const user = await tx.user.findUnique({
                where: { id: payment.userId },
                select: { credits: true },
              });
              const deduct = Math.min(granted, user?.credits ?? 0);
              if (deduct > 0) {
                await tx.user.update({
                  where: { id: payment.userId },
                  data: { credits: { decrement: deduct } },
                });
              }
              await tx.creditTransaction.create({
                data: {
                  userId: payment.userId,
                  amount: -deduct,
                  type: 'PURCHASE',
                  description: `Refund: reversed ${deduct} credits (payment ${refund.payment_id})`,
                },
              });
            });
          }
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Webhook processing failed for event ${event}`, error);
      throw new InternalServerErrorException('Webhook processing failed');
    }

    return { received: true };
  }

  async getPaymentHistory(userId: string): Promise<PaymentHistoryItem[]> {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return payments.map((p: any) => ({
      id: p.id,
      orderId: p.razorpayOrderId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      type: p.type,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async getPricingConfig(): Promise<Record<string, string>> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'pricing.' } },
    });
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /**
   * Credits to grant for a completed payment. Prefers the `credits` value
   * captured in the payment metadata at order-creation time (the
   * authoritative pack definition), so the user receives exactly what was
   * advertised. Falls back to the amount-based heuristic for legacy
   * payments created before packs stored their credit count.
   */
  private creditsForPayment(payment: { amount: unknown; metadata?: unknown }): number {
    const meta = (payment?.metadata ?? null) as { credits?: unknown } | null;
    const metaCredits =
      meta && typeof meta.credits === 'number' && Number.isFinite(meta.credits) && meta.credits > 0
        ? meta.credits
        : null;
    return metaCredits ?? this.calculateCredits(Number(payment.amount));
  }

  /**
   * Revoke Premium when a subscription ends, but only if the user has no
   * OTHER still-active subscription, and only for a currently-PREMIUM user
   * (the `role: 'PREMIUM'` guard in updateMany leaves ADMIN accounts and
   * already-downgraded users untouched). Runs inside the caller's
   * transaction so the status change and the downgrade commit atomically.
   */
  private async revokePremiumIfNoActiveSub(tx: any, userId: string): Promise<void> {
    const activeCount = await tx.subscription.count({
      where: { userId, status: 'ACTIVE' },
    });
    if (activeCount > 0) return; // another active subscription still entitles them
    await tx.user.updateMany({
      where: { id: userId, role: 'PREMIUM' },
      data: { role: 'USER' },
    });
  }

  private calculateCredits(amountINR: number): number {
    if (amountINR >= 699) return 100;
    if (amountINR >= 399) return 50;
    if (amountINR >= 99) return 10;
    return Math.max(1, Math.floor(amountINR / 10));
  }
}
