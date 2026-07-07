import {
  Injectable,
  Optional,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { MetricsService } from '../../metrics/metrics.service';
import {
  FeatureAccessService,
  EntitlementTypeName,
} from '../../common/feature-access/feature-access.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import { CreateOrderDto, VerifyPaymentDto, CreateSubscriptionDto, GoogleVerifyDto } from './dto';
import {
  CashfreeClient,
  CashfreeConfig,
  verifyCashfreeSignature,
} from './cashfree.client';
import { GooglePlayClient } from './google-play.client';

/** Default INR prices for one-time entitlement products (admin-overridable). */
const DEFAULT_REPORT_PRICE_INR = 199;
const DEFAULT_PALMISTRY_PRICE_INR = 250;

/** Play subscription SKUs → logical plan tier (mirrors CASHFREE_PLAN_* mapping). */
const GOOGLE_SUB_PLANS: Record<string, 'MONTHLY' | 'ANNUAL'> = {
  premium_monthly: 'MONTHLY',
  premium_annual: 'ANNUAL',
};

const sha256Hex = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

/** Constant-time string compare (hashes first so lengths never leak). */
function timingSafeEqualStr(a: string, b: string): boolean {
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(a).digest(),
    crypto.createHash('sha256').update(b).digest(),
  );
}

/**
 * Map a one-time-purchase productId to its EntitlementType, or null if the
 * productId is not an entitlement product (e.g. a credit pack). All report
 * variants unlock that specific report type; `palm_reading` is the
 * canonical palmistry product (legacy `report_palm` maps to REPORT_PALM).
 */
/**
 * Map an overage-pack productId to the usage feature it tops up, or null if the
 * product is not an overage pack. Overage packs are sold through the same
 * one-time-order rails as credit packs (productId `credits_overage_<feature>`,
 * priced/sized by `pricing.credits.overage_<feature>.{price,credits}`), but at
 * settlement they raise the feature's usage allowance rather than granting
 * generic credits.
 */
function overageFeatureForProduct(productId?: string): 'palmistry' | 'chat' | null {
  if (!productId) return null;
  const packId = productId.replace(/^credits[_.]/i, '');
  if (packId === 'overage_palmistry') return 'palmistry';
  if (packId === 'overage_chat') return 'chat';
  return null;
}

function entitlementTypeForProduct(productId: string): EntitlementTypeName | null {
  switch (productId) {
    case 'report_life':
      return 'REPORT_LIFE';
    case 'report_career':
      return 'REPORT_CAREER';
    case 'report_marriage':
      return 'REPORT_MARRIAGE';
    case 'report_wealth':
      return 'REPORT_WEALTH';
    case 'report_annual':
      return 'REPORT_ANNUAL';
    case 'report_palm':
      return 'REPORT_PALM';
    case 'palm_reading':
      return 'PALMISTRY';
    default:
      return null;
  }
}

export interface CashfreeOrder {
  /** Our order id (`cf_<uuid>`), used as the gateway order id. */
  orderId: string;
  /** Token the web SDK passes to `cashfree.checkout({ paymentSessionId })`. */
  paymentSessionId: string | null;
  /** Amount in INR rupees. */
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  paymentId: string;
  orderId: string;
  creditsAdded?: number;
  /** True when this payment granted a one-time pay-to-unlock entitlement
   *  (report/palmistry) rather than credits, so the web can proceed
   *  straight to generation. */
  entitlementGranted?: boolean;
}

export interface SubscriptionResult {
  id: string;
  planId: string;
  status: string;
  currentStart: string;
  currentEnd: string;
  /** Session id the web SDK passes to `cashfree.subscriptionsCheckout` so the
   *  customer authorises the mandate (UPI AutoPay / eNACH / card). Undefined
   *  in mock mode (no credentials). */
  authSessionId?: string;
  /** Fallback hosted authorization link, when Cashfree returns one. */
  authLink?: string;
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

/** The current user's subscription summary for the profile billing card. */
export interface MySubscription {
  id: string;
  plan: string;
  status: string;
  startDate: string;
  endDate: string | null;
  provider: string | null;
  /** True when the subscription currently entitles the user (ACTIVE + not expired). */
  active: boolean;
  /** Whether a cancel action applies (an active subscription exists). */
  cancellable: boolean;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  /** Null when no credentials are configured → "mock mode" for local dev. */
  private cashfree: CashfreeClient | null = null;
  /** Null when no Play service account is configured → "mock mode" (Rail B). */
  private googlePlay: GooglePlayClient | null = null;
  /** Throttle for Sentry webhook-failure alerts, keyed by outcome (epoch ms). */
  private readonly lastWebhookAlertAt: Record<string, number> = {};

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private featureAccess: FeatureAccessService,
    // Global @Global() MetricsModule provides this in the running app; it is
    // optional so unit tests can construct the service without wiring metrics.
    @Optional() private readonly metrics?: MetricsService,
  ) {
    this.initCashfree();
    this.initGooglePlay();
  }

  /**
   * Record a webhook outcome to Prometheus and, for failure outcomes, raise a
   * rate-limited Sentry alert. Signature/timestamp rejections are 4xx and so
   * never reach the 5xx-only HttpExceptionFilter — without this they would be
   * invisible, hiding both misconfiguration and forging attempts.
   */
  private recordWebhookOutcome(outcome: string): void {
    try {
      this.metrics?.cashfreeWebhookTotal.inc({ outcome });
    } catch {
      // never let metrics break webhook handling
    }
    if (outcome === 'ok') return;
    const now = Date.now();
    const last = this.lastWebhookAlertAt[outcome] ?? 0;
    if (now - last > 60_000) {
      this.lastWebhookAlertAt[outcome] = now;
      Sentry.captureMessage(`Cashfree webhook rejected: ${outcome}`, 'warning');
    }
  }

  private initCashfree(): void {
    const clientId = this.configService.get<string>('cashfree.clientId');
    const clientSecret = this.configService.get<string>('cashfree.clientSecret');

    if (clientId && clientSecret) {
      const cfg: CashfreeConfig = {
        clientId,
        clientSecret,
        mode: this.configService.get<string>('cashfree.mode') || 'sandbox',
        apiVersion: this.configService.get<string>('cashfree.apiVersion') || '2025-01-01',
      };
      this.cashfree = new CashfreeClient(cfg);
      this.logger.log(`Cashfree initialized (mode=${cfg.mode})`);
      this.warnOnIncompleteConfig();
    } else {
      this.cashfree = null;
      this.logger.warn('Cashfree credentials not configured, using mock mode');
    }
  }

  private initGooglePlay(): void {
    const serviceAccountJson = this.configService.get<string>('googlePlay.serviceAccountJson');
    const packageName =
      this.configService.get<string>('googlePlay.packageName') || 'com.myastro360.app';
    if (serviceAccountJson) {
      try {
        this.googlePlay = new GooglePlayClient({ serviceAccountJson, packageName });
        this.logger.log(`Google Play client initialized (${packageName})`);
      } catch (error) {
        this.googlePlay = null;
        this.logger.error(
          `Google Play service-account JSON is invalid: ${(error as Error).message}`,
        );
      }
    } else {
      this.googlePlay = null;
      this.logger.warn('Google Play credentials not configured, using mock mode');
    }
  }

  /**
   * Surface common misconfigurations at boot rather than at the first failing
   * request. With credentials set but these missing, the failures are otherwise
   * cryptic and late: a missing plan id throws "Subscription plan is not
   * configured" only when a user tries to subscribe, and a missing API_PUBLIC_URL
   * silently omits the webhook notify_url so subscriptions never activate.
   */
  private warnOnIncompleteConfig(): void {
    const planMonthly = this.configService.get<string>('cashfree.planMonthly');
    const planAnnual = this.configService.get<string>('cashfree.planAnnual');
    if (!planMonthly || !planAnnual) {
      this.logger.warn(
        'Cashfree subscription plan IDs incomplete — set CASHFREE_PLAN_MONTHLY and ' +
          'CASHFREE_PLAN_ANNUAL to the plan IDs from the Cashfree dashboard. ' +
          'Subscribe requests will fail until both are set (one-time orders still work).',
      );
    }
    if (!this.configService.get<string>('apiUrl')) {
      this.logger.warn(
        'API_PUBLIC_URL is not set — Cashfree webhooks have no per-order notify_url. ' +
          'Set it to the public HTTPS API base (…/api), or configure the webhook globally ' +
          'in the Cashfree dashboard. Without webhook delivery, subscription activation ' +
          'will not happen (one-time orders still settle via the synchronous verify path).',
      );
    }
  }

  /** Secret used to verify webhook signatures: the dedicated webhook secret if
   *  set, otherwise the client secret (Cashfree's default signing key). */
  private webhookSecret(): string | undefined {
    return (
      this.configService.get<string>('cashfree.webhookSecret') ||
      this.configService.get<string>('cashfree.clientSecret') ||
      undefined
    );
  }

  /**
   * Authoritative price (in INR rupees) the client must pay for a productId.
   * One-time entitlement products (reports / palmistry) read their INR price
   * from the admin-editable `site_settings` (`pricing.report.price`,
   * `pricing.palmistry.price`) so the operator can re-price without a redeploy
   * — the SAME source the web pricing surface reads. Legacy credit-pack
   * productIds keep their static fallbacks. Returns null for unknown products.
   */
  private async getExpectedPrice(productId: string): Promise<number | null> {
    const entType = entitlementTypeForProduct(productId);
    if (entType) {
      const isPalmistry = entType === 'PALMISTRY';
      const key = isPalmistry ? 'pricing.palmistry.price' : 'pricing.report.price';
      const fallback = isPalmistry ? DEFAULT_PALMISTRY_PRICE_INR : DEFAULT_REPORT_PRICE_INR;
      const row = await this.prisma.siteSetting.findUnique({ where: { key } });
      const inr = parseInt(row?.value ?? '', 10);
      return Number.isFinite(inr) && inr > 0 ? inr : fallback;
    }

    const prices: Record<string, number> = {
      credits_10: 99,
      credits_50: 399,
      credits_100: 699,
    };
    return prices[productId] ?? null;
  }

  /**
   * Resolve a credit pack (starter / popular / pro …) from the admin-editable
   * SiteSettings — the SAME source the web /pricing page reads. This is the
   * single source of truth for both the price the client must pay (INR rupees)
   * and the number of credits we grant, so the two can never drift. Returns
   * null for unknown packs or malformed/missing settings.
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

  async createOrder(userId: string, dto: CreateOrderDto): Promise<CashfreeOrder> {
    this.logger.log(`Creating order for user: ${userId}, amount: ${dto.amount}`);

    // Resolve how many credits this purchase grants, and validate the amount,
    // against the authoritative price (INR rupees). Credit packs are looked up
    // in SiteSettings; everything else falls back to the static price map.
    let grantedCredits: number | undefined;
    let entitlementType: EntitlementTypeName | null = null;
    let paymentType: 'CREDITS' | 'REPORT' = 'CREDITS';
    if (dto.productId) {
      // Subscribe-first: only active subscribers may buy overage top-ups,
      // unless the operator has opened them to free users. Blocks a free user
      // from hitting the checkout URL directly to bypass subscribing.
      if (overageFeatureForProduct(dto.productId)) {
        const allowed =
          (await this.featureAccess.overageForFreeEnabled()) ||
          (await this.featureAccess.isActiveSubscriber(userId));
        if (!allowed) {
          throw new PaymentRequiredException(
            'Subscribe to unlock top-ups for this feature.',
            { subscribe: true },
          );
        }
      }
      const pack = await this.resolveCreditPack(dto.productId);
      if (pack) {
        if (dto.amount !== pack.priceINR) {
          throw new BadRequestException(
            `Invalid amount for ${dto.productId}. Expected ${pack.priceINR}, got ${dto.amount}`,
          );
        }
        grantedCredits = pack.credits;
      } else {
        const expectedPrice = await this.getExpectedPrice(dto.productId);
        if (expectedPrice !== null && dto.amount !== expectedPrice) {
          throw new BadRequestException(
            `Invalid amount for product ${dto.productId}. Expected ${expectedPrice}, got ${dto.amount}`,
          );
        }
        // One-time pay-to-unlock products (reports/palmistry) grant an
        // Entitlement on success instead of credits.
        entitlementType = entitlementTypeForProduct(dto.productId);
        if (entitlementType) {
          paymentType = 'REPORT';
        } else if (expectedPrice !== null) {
          // Known legacy static credit pack (credits_10/50/100): capture its
          // fixed credit count now, from the authoritative price, so settlement
          // records an explicit grant and never has to infer credits from the
          // paid amount.
          grantedCredits = this.calculateCredits(expectedPrice);
        }
        // Unknown productId (expectedPrice === null) is intentionally allowed:
        // it's a custom-amount order (e.g. a donation — see
        // security-comprehensive.spec). grantedCredits stays undefined, so no
        // `credits` is recorded and settlement grants 0 — an arbitrary
        // caller-chosen id + amount can never mint credits.
      }
    }

    const orderId = `cf_${crypto.randomUUID()}`;
    const currency = dto.currency || 'INR';
    let orderAmount = dto.amount; // rupees
    let paymentSessionId: string | null = null;
    let status = 'ACTIVE';

    if (this.cashfree) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, phone: true },
      });
      const frontendUrl = this.configService.get<string>('frontendUrl') || '';
      const apiUrl = this.configService.get<string>('apiUrl') || '';
      try {
        const order = await this.cashfree.createOrder({
          orderId,
          orderAmount,
          orderCurrency: currency,
          customer: {
            id: userId,
            name: user?.name,
            email: user?.email,
            phone: user?.phone,
          },
          // Cashfree substitutes `{order_id}` into the return_url on redirect.
          // `pid` lets the fallback return page route to the right success
          // destination after a UPI app-switch full-page redirect.
          returnUrl: frontendUrl
            ? `${frontendUrl}/checkout/return?orderId={order_id}&pid=${encodeURIComponent(dto.productId)}`
            : undefined,
          notifyUrl: apiUrl
            ? `${apiUrl.replace(/\/$/, '')}/payments/webhook`
            : undefined,
        });
        orderAmount = Number(order.order_amount ?? orderAmount);
        paymentSessionId = order.payment_session_id ?? null;
        status = order.order_status ?? status;
      } catch (error) {
        this.logger.error('Cashfree order creation failed', error as Error);
        throw new InternalServerErrorException('Failed to create payment order');
      }
    } else if ((process.env.NODE_ENV ?? '') === 'production') {
      // Fail-CLOSED: in production a missing Cashfree config must surface a
      // clear error, not a fake `session_mock_…` that the browser SDK then
      // rejects with a cryptic "payment_session_id is invalid". This is the
      // signal that CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET aren't set (or
      // the API wasn't redeployed after setting them).
      this.logger.error('createOrder: Cashfree not configured — refusing to create order');
      throw new InternalServerErrorException('Payments are not configured');
    } else {
      // Mock mode (local dev only): deterministic ids, no network call.
      paymentSessionId = `session_mock_${crypto.randomUUID().substring(0, 14)}`;
    }

    await this.prisma.payment.create({
      data: {
        userId,
        amount: orderAmount, // Cashfree amounts are already in rupees
        currency,
        status: 'PENDING',
        gatewayOrderId: orderId,
        provider: 'cashfree',
        type: paymentType,
        // `credits` is captured at order-creation time from the authoritative
        // pack definition, so the grant on verify/webhook is deterministic and
        // never re-derived from the amount. `entitlementType` marks one-time
        // pay-to-unlock purchases so the handler grants an Entitlement instead.
        metadata: {
          productId: dto.productId,
          description: dto.description,
          credits: grantedCredits,
          entitlementType: entitlementType ?? undefined,
          kind: entitlementType ? 'entitlement' : 'credits',
        },
      },
    });

    return {
      orderId,
      paymentSessionId,
      amount: orderAmount,
      currency,
      status,
    };
  }

  async verifyPayment(
    userId: string,
    dto: VerifyPaymentDto,
  ): Promise<PaymentVerificationResult> {
    this.logger.log(`Verifying payment for user: ${userId}, order: ${dto.orderId}`);

    // The payment row we created at order time (scoped to this user). Its
    // amount is the authoritative figure we re-check against Cashfree.
    const existing = await this.prisma.payment.findFirst({
      where: { gatewayOrderId: dto.orderId, userId },
      select: { id: true, amount: true },
    });
    if (!existing) {
      throw new BadRequestException('Payment record not found for this order');
    }

    // ── Authenticity gate ──────────────────────────────────────────────────
    // Cashfree verification is server-authoritative: we fetch the order from
    // Cashfree and require order_status === 'PAID'. We also re-validate the
    // amount Cashfree settled against what we persisted at order creation, so
    // a tampered/short payment can never grant the full product.
    let paid = false;
    let gatewayPaymentId: string | null = null;
    if (this.cashfree) {
      let order: any;
      try {
        order = await this.cashfree.getOrder(dto.orderId);
      } catch (error) {
        this.logger.error(`verifyPayment: getOrder failed for ${dto.orderId}`, error as Error);
        throw new InternalServerErrorException('Unable to verify payment');
      }
      paid = String(order?.order_status ?? '').toUpperCase() === 'PAID';
      if (paid) {
        const apiAmount = Number(order?.order_amount);
        const expected = Number(existing.amount);
        if (!Number.isFinite(apiAmount) || Math.abs(apiAmount - expected) > 0.001) {
          this.logger.error(
            `verifyPayment amount mismatch order=${dto.orderId} cashfree=${apiAmount} expected=${expected}`,
          );
          throw new BadRequestException('Payment verification failed: amount mismatch');
        }
        gatewayPaymentId = order?.cf_order_id ? `cf_${order.cf_order_id}` : null;
      }
    } else if ((process.env.NODE_ENV ?? '') !== 'production') {
      // Local/dev mock mode (no Cashfree creds): treat as paid so the flow is
      // testable without the gateway. NEVER reachable in production.
      paid = true;
    } else {
      // Fail-CLOSED: a misconfigured production deploy must not become a free
      // credit faucet.
      this.logger.error('verifyPayment: Cashfree not configured — refusing to verify');
      throw new InternalServerErrorException('Payment verification is not configured');
    }

    if (!paid) {
      // Order exists but isn't settled (ACTIVE/EXPIRED/FAILED). Grant nothing;
      // the webhook remains the authoritative async path if it settles later.
      return { verified: false, paymentId: '', orderId: dto.orderId };
    }

    // Claim + grant atomically and exactly once (idempotent against the
    // verify-vs-webhook race and client retries). Scoped to this user.
    const grant = await this.settlePaidOrder(dto.orderId, {
      userId,
      gatewayPaymentId: gatewayPaymentId ?? undefined,
    });

    return {
      verified: true,
      paymentId: gatewayPaymentId ?? dto.orderId,
      orderId: dto.orderId,
      creditsAdded: grant.creditsAdded,
      ...(grant.entitlementGranted ? { entitlementGranted: true } : {}),
    };
  }

  /**
   * Atomically claim a PAID Cashfree order as SUCCESS and grant its credits or
   * one-time entitlement EXACTLY ONCE. Shared by `verifyPayment`, the
   * `PAYMENT_SUCCESS_WEBHOOK` handler, and the reconcile job — the status-guarded
   * `updateMany` makes it idempotent across all three paths and across
   * retries/replays. When `userId` is supplied the claim is additionally scoped
   * to that user (the verify path). Authenticity/amount must already be
   * established by the caller before calling this.
   */
  private async settlePaidOrder(
    orderId: string,
    opts: { userId?: string; gatewayPaymentId?: string } = {},
  ): Promise<{ claimed: boolean; creditsAdded: number; entitlementGranted: boolean }> {
    const { userId, gatewayPaymentId } = opts;
    return this.prisma.$transaction(async (tx: any) => {
      const { count } = await tx.payment.updateMany({
        where: {
          gatewayOrderId: orderId,
          // Only ever settle an order that has not already been granted OR
          // refunded. `not: 'SUCCESS'` alone let a REFUNDED payment match again,
          // so a webhook/reconcile replay after a refund re-granted its credits
          // (or re-granted the entitlement) a second time — a clawed-back order
          // must stay terminal.
          status: { notIn: ['SUCCESS', 'REFUNDED'] },
          ...(userId ? { userId } : {}),
        },
        data: { status: 'SUCCESS', ...(gatewayPaymentId ? { gatewayPaymentId } : {}) },
      });
      if (count === 0) {
        // Lost the race / already settled — idempotent no-op.
        return { claimed: false, creditsAdded: 0, entitlementGranted: false };
      }
      const payment = await tx.payment.findFirstOrThrow({
        where: { gatewayOrderId: orderId, ...(userId ? { userId } : {}) },
        select: { id: true, userId: true, amount: true, metadata: true },
      });
      const entType = this.entitlementTypeFromMetadata(payment.metadata);
      if (entType) {
        await this.featureAccess.grantEntitlement(payment.userId, payment.id, entType, tx);
        return { claimed: true, creditsAdded: 0, entitlementGranted: true };
      }
      // Overage pack (subscription model): top up the feature's usage allowance
      // instead of granting generic credits. The pack's unit count is the
      // `credits` captured in metadata (e.g. +2 palmistry, +350 chat messages).
      const overageFeature = overageFeatureForProduct(
        (payment.metadata as { productId?: string } | null)?.productId,
      );
      if (overageFeature) {
        const units = this.creditsForPayment(payment);
        await this.featureAccess.addUsageBonus(payment.userId, overageFeature, units, tx);
        return { claimed: true, creditsAdded: 0, entitlementGranted: false };
      }
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
          description: `Purchased ${creditsToAdd} credits`,
        },
      });
      return { claimed: true, creditsAdded: creditsToAdd, entitlementGranted: false };
    });
  }

  /**
   * Safety net for missed/dropped webhooks: find Cashfree payments still PENDING
   * after a grace period, re-fetch their status, and settle (grant) any that
   * Cashfree reports PAID — or mark terminal ones FAILED. Idempotent via
   * `settlePaidOrder`. Invoked on a schedule by PaymentReconcileService.
   */
  async reconcilePendingPayments(graceMinutes = 15, batch = 100): Promise<{ checked: number; settled: number }> {
    if (!this.cashfree) return { checked: 0, settled: 0 };
    const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
    // Don't rescan ancient rows — Cashfree orders stop being payable well within
    // this window, and it keeps the FAILED sweep bounded.
    const floor = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const stale = await this.prisma.payment.findMany({
      where: {
        // Include FAILED, not just PENDING: handlePaymentFailed marks a row
        // FAILED on any failed *attempt* even though the Cashfree order remains
        // payable, so a later successful retry whose webhook AND client-verify
        // are both lost would otherwise never be reconciled — money taken, no
        // product granted. settlePaidOrder still only grants once.
        status: { in: ['PENDING', 'FAILED'] },
        provider: 'cashfree',
        createdAt: { lt: cutoff, gt: floor },
      },
      select: { gatewayOrderId: true, amount: true },
      take: batch,
    });

    let settled = 0;
    for (const p of stale) {
      if (!p.gatewayOrderId) continue;
      try {
        const order: any = await this.cashfree.getOrder(p.gatewayOrderId);
        const status = String(order?.order_status ?? '').toUpperCase();
        if (status === 'PAID') {
          const apiAmount = Number(order?.order_amount);
          const expected = Number(p.amount);
          if (!Number.isFinite(apiAmount) || Math.abs(apiAmount - expected) > 0.001) {
            this.logger.error(
              `reconcile: amount mismatch order=${p.gatewayOrderId} cashfree=${apiAmount} expected=${expected}`,
            );
            continue;
          }
          const cfPaymentId = order?.cf_order_id ? `cf_${order.cf_order_id}` : undefined;
          const r = await this.settlePaidOrder(p.gatewayOrderId, { gatewayPaymentId: cfPaymentId });
          if (r.claimed) settled++;
        } else if (['EXPIRED', 'TERMINATED', 'FAILED'].includes(status)) {
          await this.prisma.payment.updateMany({
            where: { gatewayOrderId: p.gatewayOrderId, status: { notIn: ['SUCCESS', 'REFUNDED'] } },
            data: { status: 'FAILED' },
          });
        }
      } catch (error) {
        this.logger.warn(`reconcile: failed to settle ${p.gatewayOrderId}: ${(error as Error).message}`);
      }
    }
    if (settled > 0) this.logger.log(`reconcile: settled ${settled}/${stale.length} stale payment(s)`);
    return { checked: stale.length, settled };
  }

  /**
   * Initiate a refund for a successful Cashfree payment. We only ask Cashfree
   * to refund — the actual ledger reversal (mark REFUNDED + claw back credits /
   * void entitlement) happens idempotently when the `REFUND_STATUS_WEBHOOK`
   * arrives, exactly like a dashboard-initiated refund. Admin-only caller.
   */
  async refundPayment(
    paymentId: string,
    opts: { amount?: number; note?: string } = {},
  ): Promise<{ refundId: string; status: string; amount: number }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, gatewayOrderId: true, amount: true, status: true, provider: true },
    });
    if (!payment) throw new BadRequestException('Payment not found');
    if (payment.status !== 'SUCCESS') {
      throw new BadRequestException('Only successful payments can be refunded');
    }
    if (payment.provider !== 'cashfree') {
      throw new BadRequestException('Refunds are only supported for Cashfree payments');
    }
    if (!payment.gatewayOrderId) {
      throw new BadRequestException('Payment has no gateway order id to refund');
    }
    const full = Number(payment.amount);
    const amount = opts.amount != null ? Number(opts.amount) : full;
    if (!(amount > 0) || amount > full + 0.001) {
      throw new BadRequestException(`Refund amount must be between 0 and ${full}`);
    }
    if (!this.cashfree) {
      throw new InternalServerErrorException('Cashfree is not configured');
    }
    const refundId = `rf_${crypto.randomUUID().replace(/-/g, '').substring(0, 20)}`;
    try {
      await this.cashfree.createRefund(payment.gatewayOrderId, {
        refundId,
        refundAmount: amount,
        refundNote: opts.note,
      });
    } catch (error) {
      this.logger.error(`refundPayment: Cashfree refund failed for ${paymentId}`, error as Error);
      throw new InternalServerErrorException('Failed to initiate refund with Cashfree');
    }
    this.logger.log(`Refund initiated for payment ${paymentId}: ₹${amount} (refundId=${refundId})`);
    return { refundId, status: 'INITIATED', amount };
  }

  /** Extract the EntitlementType captured in a payment's metadata, if any. */
  private entitlementTypeFromMetadata(metadata: unknown): EntitlementTypeName | null {
    const meta = (metadata ?? null) as { entitlementType?: unknown } | null;
    const v = meta?.entitlementType;
    return typeof v === 'string' ? (v as EntitlementTypeName) : null;
  }

  async createSubscription(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResult> {
    const isAnnual = dto.plan.toUpperCase() === 'ANNUAL';
    this.logger.log(`Creating subscription for user: ${userId}, plan: ${dto.plan}`);

    // Don't sell a subscription the app won't honor: isActiveSubscriber (and
    // therefore every premium gate) returns false while
    // feature.subscriptions_enabled is off, so creating one here would take the
    // customer's money and grant zero access. Refuse unless the operator has
    // switched on the subscription model.
    if (!(await this.featureAccess.subscriptionsEnabled())) {
      throw new BadRequestException('Subscriptions are not currently available.');
    }

    // Idempotency: refuse to mint a second subscription for a user who already
    // holds a live one, so an abandoned-then-retried checkout can't accumulate
    // multiple ACTIVE rows (which would block correct downgrade on cancel).
    const existingActive = await this.prisma.subscription.count({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
    });
    if (existingActive > 0) {
      throw new BadRequestException('You already have an active subscription.');
    }

    // Map the logical tier to a real Cashfree plan_id configured out of band
    // (dashboard → env). The client never supplies a raw plan_id, so it can't
    // subscribe itself to an arbitrary/cheaper plan.
    const planId = isAnnual
      ? this.configService.get<string>('cashfree.planAnnual')
      : this.configService.get<string>('cashfree.planMonthly');

    const subscriptionId = `sub_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
    const endDate = new Date(Date.now() + (isAnnual ? 365 : 30) * 24 * 60 * 60 * 1000);
    let authSessionId: string | undefined;
    let authLink: string | undefined;
    let status = 'active';

    if (this.cashfree) {
      if (!planId) {
        this.logger.error(`No Cashfree plan_id configured for ${isAnnual ? 'ANNUAL' : 'MONTHLY'}`);
        throw new InternalServerErrorException('Subscription plan is not configured');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, phone: true },
      });
      const frontendUrl = this.configService.get<string>('frontendUrl') || '';
      const apiUrl = this.configService.get<string>('apiUrl') || '';
      try {
        const res = await this.cashfree.createSubscription({
          subscription_id: subscriptionId,
          plan_details: { plan_id: planId },
          customer_details: {
            customer_id: userId.replace(/-/g, ''),
            customer_name: user?.name ?? undefined,
            customer_email: user?.email ?? undefined,
            customer_phone: (user?.phone ?? '').replace(/\D/g, '').slice(-10) || '9999999999',
          },
          subscription_meta: {
            return_url: frontendUrl
              ? `${frontendUrl}/checkout/return?subscriptionId=${subscriptionId}`
              : undefined,
            notify_url: apiUrl
              ? `${apiUrl.replace(/\/$/, '')}/payments/webhook`
              : undefined,
          },
        });
        // Field names vary by Cashfree API surface/version — accept the known
        // shapes for the authorization session/link the web SDK consumes.
        authSessionId =
          res?.subscription_session_id ??
          res?.subscription_session ??
          res?.authorization_details?.subscription_session_id ??
          undefined;
        authLink =
          res?.authorization_details?.authorization_link ??
          res?.auth_link ??
          res?.subscription_url ??
          undefined;
        status = res?.subscription_status ?? status;
      } catch (error) {
        this.logger.error('Cashfree subscription creation failed', error as Error);
        throw new InternalServerErrorException('Failed to create subscription');
      }
    }

    // Fail-CLOSED in production when Cashfree is unconfigured: otherwise the
    // mock-mode branch below would hand a free ACTIVE subscription + PREMIUM
    // role to any caller (createOrder/verifyPayment already refuse this).
    if (!this.cashfree && (process.env.NODE_ENV ?? '') === 'production') {
      this.logger.error('createSubscription: Cashfree not configured — refusing to grant subscription');
      throw new InternalServerErrorException('Subscriptions are not configured');
    }

    // We do NOT grant PREMIUM here in live mode: the mandate isn't authorised
    // and no charge has settled yet, so granting on creation would hand free
    // access to anyone who opens — then abandons — the authorization. Premium
    // is granted from the SUBSCRIPTION_STATUS_CHANGE (ACTIVE) / charge webhook.
    // Mock mode (no credentials, non-production only) grants immediately to keep
    // local dev usable.
    const grantImmediately = !this.cashfree;
    await this.prisma.$transaction(async (tx: any) => {
      await tx.subscription.create({
        data: {
          userId,
          plan: isAnnual ? 'ANNUAL' : 'MONTHLY',
          status: grantImmediately ? 'ACTIVE' : 'PENDING',
          gatewaySubscriptionId: subscriptionId,
          provider: 'cashfree',
          endDate,
        },
      });
      if (grantImmediately) {
        await tx.user.update({ where: { id: userId }, data: { role: 'PREMIUM' } });
      }
    });

    return {
      id: subscriptionId,
      planId: planId || (isAnnual ? 'ANNUAL' : 'MONTHLY'),
      status,
      currentStart: new Date().toISOString(),
      currentEnd: endDate.toISOString(),
      authSessionId,
      authLink,
    };
  }

  async handleWebhook(
    payload: Record<string, any>,
    signatureHeader?: string,
    timestampHeader?: string,
    rawBody?: Buffer,
  ): Promise<{ received: boolean }> {
    // Fail-CLOSED when the secret is missing. A webhook endpoint with no
    // signature check is a public credit-grant API; refuse to run unconfigured.
    const secret = this.webhookSecret();
    if (!secret) {
      this.logger.error('handleWebhook: Cashfree secret not configured — refusing to process');
      this.recordWebhookOutcome('not_configured');
      throw new InternalServerErrorException('Webhook processing is not configured');
    }
    if (!signatureHeader) {
      this.logger.warn('Webhook received without signature header - rejecting');
      this.recordWebhookOutcome('missing_signature');
      throw new BadRequestException('Missing webhook signature');
    }
    if (!timestampHeader) {
      this.logger.warn('Webhook received without timestamp header - rejecting');
      this.recordWebhookOutcome('missing_timestamp');
      throw new BadRequestException('Missing webhook timestamp');
    }

    // Replay guard: the timestamp is part of the signed data, so a captured
    // delivery replayed later is rejected once it falls outside the window.
    const tolerance =
      this.configService.get<number>('cashfree.webhookToleranceSeconds') ?? 300;
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts)) {
      this.recordWebhookOutcome('invalid_timestamp');
      throw new BadRequestException('Invalid webhook timestamp');
    }
    const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (skew > tolerance) {
      this.logger.warn(`Webhook timestamp outside tolerance (skew=${skew}s) - rejecting`);
      this.recordWebhookOutcome('stale_timestamp');
      throw new BadRequestException('Webhook timestamp outside allowed window');
    }

    // The signature must be computed over the EXACT bytes Cashfree sent.
    // `req.rawBody` (enabled via `rawBody: true` in main.ts) preserves them; a
    // re-serialization of the parsed JSON does not. In production we REQUIRE
    // the raw buffer; outside production we fall back to a canonical
    // re-serialization so unit tests (which pass a parsed payload) keep working.
    let bodyBuf: Buffer;
    if (rawBody && rawBody.length > 0) {
      bodyBuf = rawBody;
    } else if ((process.env.NODE_ENV ?? '') === 'production') {
      this.logger.error('handleWebhook: raw request body unavailable — cannot verify signature');
      this.recordWebhookOutcome('body_unavailable');
      throw new BadRequestException('Webhook body unavailable');
    } else {
      bodyBuf = Buffer.from(JSON.stringify(payload));
    }

    if (!verifyCashfreeSignature(secret, timestampHeader, bodyBuf, signatureHeader)) {
      this.logger.warn('Webhook signature verification failed');
      this.recordWebhookOutcome('bad_signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = String(payload?.type ?? 'unknown');
    this.logger.log(`Webhook received: ${event}`);
    const data = payload?.data ?? {};

    try {
      switch (event) {
        case 'PAYMENT_SUCCESS_WEBHOOK':
          await this.handlePaymentSuccess(data);
          break;
        case 'PAYMENT_FAILED_WEBHOOK':
        case 'PAYMENT_USER_DROPPED_WEBHOOK':
          await this.handlePaymentFailed(data);
          break;
        case 'REFUND_STATUS_WEBHOOK':
          await this.handleRefund(data);
          break;
        case 'SUBSCRIPTION_STATUS_CHANGE':
          await this.handleSubscriptionStatusChange(data);
          break;
        default:
          // Subscription auth/charge events grant Premium on a successful
          // payment regardless of the exact event-type string Cashfree uses
          // (the names differ across API surfaces). Anything else is a no-op.
          if (event.startsWith('SUBSCRIPTION')) {
            await this.handleSubscriptionCharge(data);
          }
          break;
      }
    } catch (error) {
      this.logger.error(`Webhook processing failed for event ${event}`, error as Error);
      this.recordWebhookOutcome('processing_error');
      throw new InternalServerErrorException('Webhook processing failed');
    }

    this.recordWebhookOutcome('ok');
    return { received: true };
  }

  // ── Webhook handlers ──────────────────────────────────────────────────────

  private async handlePaymentSuccess(data: any): Promise<void> {
    const orderId = data?.order?.order_id;
    if (!orderId) return;
    const cfPaymentId = data?.payment?.cf_payment_id;
    const gatewayPaymentId = cfPaymentId != null ? `cf_${cfPaymentId}` : undefined;
    // Same idempotent, status-guarded grant as verify/reconcile — a concurrent
    // client verify + this webhook can both pass the gate, but only one claims
    // the row and grants.
    await this.settlePaidOrder(orderId, { gatewayPaymentId });
  }

  private async handlePaymentFailed(data: any): Promise<void> {
    const orderId = data?.order?.order_id;
    if (!orderId) return;
    // Only still-pending rows may transition to FAILED, so a duplicate/out-of-
    // order delivery can't flip an already-settled payment (which would corrupt
    // the ledger and orphan a granted entitlement).
    await this.prisma.payment.updateMany({
      where: { gatewayOrderId: orderId, status: { notIn: ['SUCCESS', 'REFUNDED'] } },
      data: { status: 'FAILED' },
    });
  }

  private async handleRefund(data: any): Promise<void> {
    const refund = data?.refund ?? {};
    if (String(refund.refund_status ?? '').toUpperCase() !== 'SUCCESS') return;
    // Key on the order id (always present), not the payment id, so the
    // clawback works even when only the webhook (not client verify) recorded
    // the cf_payment_id.
    const orderId = refund.order_id;
    if (!orderId) return;

    await this.prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.findFirst({
        where: { gatewayOrderId: orderId, status: 'SUCCESS' },
        select: { id: true, userId: true, amount: true, metadata: true, type: true },
      });
      if (!payment) return; // already refunded, or not our payment

      // Distinguish a partial refund from a full one. Cashfree supports partial
      // refunds (refundPayment passes opts.amount), and a partial refund must
      // NOT void the whole entitlement or claw back the entire grant — only the
      // refunded fraction. Absent/!finite refund_amount is treated as a full refund.
      const refundAmount = Number(refund.refund_amount);
      const paid = Number(payment.amount);
      const isPartial =
        Number.isFinite(refundAmount) && Number.isFinite(paid) && paid > 0 && refundAmount < paid - 0.001;
      const fraction = isPartial ? Math.max(0, Math.min(1, refundAmount / paid)) : 1;

      // Flip to REFUNDED only on a full refund; a partial refund leaves the
      // order SUCCESS (it was genuinely paid and mostly stands).
      if (!isPartial) {
        await tx.payment.updateMany({
          where: { gatewayOrderId: orderId, status: 'SUCCESS' },
          data: { status: 'REFUNDED' },
        });
      }

      // One-time pay-to-unlock: void the entitlement only on a full refund so a
      // refunded user can't still redeem the unlock; a partial refund keeps it.
      if (payment.type !== 'CREDITS') {
        if (!isPartial) await this.featureAccess.voidEntitlementByPayment(payment.id, tx);
        return;
      }

      // Overage packs (credits_overage_*) top up a feature's usage allowance at
      // settlement via addUsageBonus — NOT the generic wallet. Reverse THAT, so
      // a refund doesn't wrongly claw back unrelated wallet credits.
      const overageFeature = overageFeatureForProduct(
        (payment.metadata as { productId?: string } | null)?.productId,
      );
      if (overageFeature) {
        const units = Math.round(this.creditsForPayment(payment) * fraction);
        if (units > 0) await this.featureAccess.removeUsageBonus(payment.userId, overageFeature, units, tx);
        return;
      }

      const granted = Math.round(this.creditsForPayment(payment) * fraction);
      if (granted <= 0) return;
      const user = await tx.user.findUnique({
        where: { id: payment.userId },
        select: { credits: true },
      });
      // Clamp at the current balance so the wallet never goes negative (the
      // user may have already spent some of the refunded credits).
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
          description: `Refund: reversed ${deduct} credits (order ${orderId})`,
        },
      });
    });
  }

  private async handleSubscriptionStatusChange(data: any): Promise<void> {
    const subId = this.extractSubscriptionId(data);
    if (!subId) return;
    const status = String(
      data?.subscription_status ?? data?.subscription?.subscription_status ?? '',
    ).toUpperCase();

    if (status === 'ACTIVE') {
      const expiry = data?.subscription_expiry_time ?? data?.subscription?.subscription_expiry_time;
      await this.activateSubscription(subId, parseDateOrNull(expiry));
      return;
    }

    // Terminal / access-ending states: the subscription no longer entitles the
    // user to Premium. CANCELLED is recorded as such; everything else maps to
    // EXPIRED. We err toward NOT leaving lapsed/paused subscribers with access.
    const terminal = ['CANCELLED', 'CUSTOMER CANCELLED', 'COMPLETED', 'EXPIRED', 'ON HOLD', 'PAUSED', 'CUSTOMER PAUSED'];
    if (terminal.includes(status)) {
      const newStatus = status.includes('CANCEL') ? 'CANCELLED' : 'EXPIRED';
      await this.terminateSubscription(subId, newStatus);
    }
  }

  private async handleSubscriptionCharge(data: any): Promise<void> {
    const subId = this.extractSubscriptionId(data);
    if (!subId) return;
    const paymentStatus = String(
      data?.payment_status ??
        data?.cf_payment_status ??
        data?.payment?.payment_status ??
        '',
    ).toUpperCase();
    // A successful authorization or recurring charge confirms an authorised
    // mandate — THIS is what unlocks Premium (idempotent on every renewal).
    if (paymentStatus === 'SUCCESS') {
      await this.activateSubscription(subId, null);
    }
  }

  private extractSubscriptionId(data: any): string | null {
    return (
      data?.subscription_id ??
      data?.subscription?.subscription_id ??
      data?.subscription_details?.subscription_id ??
      null
    );
  }

  /** Mark a subscription ACTIVE, grant PREMIUM, and roll the local endDate
   *  forward. Idempotent — re-granting the role on each renewal is a no-op if
   *  already PREMIUM. Keyed on our merchant subscription_id. */
  private async activateSubscription(subId: string, endDate: Date | null): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      const { count } = await tx.subscription.updateMany({
        where: { gatewaySubscriptionId: subId },
        data: { status: 'ACTIVE', ...(endDate ? { endDate } : {}) },
      });
      if (count === 0) return; // not one of our subscriptions
      const sub = await tx.subscription.findFirst({
        where: { gatewaySubscriptionId: subId },
        select: { userId: true, plan: true, endDate: true },
      });
      if (!sub) return;
      // If Cashfree didn't give us an expiry, roll the period forward from now.
      if (!endDate) {
        const days = sub.plan === 'ANNUAL' ? 365 : 30;
        await tx.subscription.updateMany({
          where: { gatewaySubscriptionId: subId },
          data: { endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000) },
        });
      }
      await tx.user.update({ where: { id: sub.userId }, data: { role: 'PREMIUM' } });
    });
  }

  /** Mark a subscription terminal and revoke PREMIUM unless the user holds
   *  another active subscription. */
  private async terminateSubscription(subId: string, newStatus: string): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      const { count } = await tx.subscription.updateMany({
        where: { gatewaySubscriptionId: subId },
        data: { status: newStatus },
      });
      if (count === 0) return;
      const sub = await tx.subscription.findFirst({
        where: { gatewaySubscriptionId: subId },
        select: { userId: true },
      });
      if (sub) await this.revokePremiumIfNoActiveSub(tx, sub.userId);
    });
  }

  // ── Google Play (Rail B) ──────────────────────────────────────────────────

  /**
   * Verify a Google Play Billing purchase server-side and grant through the
   * SAME hardened paths as Cashfree: products flow through `settlePaidOrder`
   * (status-guarded, exactly-once), subscriptions through the idempotent
   * `activateSubscription`. Play SKU ids are the same productIds the web sends
   * (`credits_starter/popular/pro`, `report_*`, `palm_reading`,
   * `premium_monthly/annual`), so the existing product resolution is reused
   * unchanged. Fail-closed in production when the Play client is unconfigured.
   */
  async verifyGooglePurchase(
    userId: string,
    dto: GoogleVerifyDto,
  ): Promise<PaymentVerificationResult> {
    if (dto.kind === 'subscription') {
      return this.verifyGoogleSubscription(userId, dto);
    }
    const { productId, purchaseToken } = dto;

    // Resolve what this SKU grants BEFORE talking to Play — unknown SKUs fail fast.
    const entType = entitlementTypeForProduct(productId);
    let credits: number | null = null;
    let amountINR: number | null = null;
    if (entType) {
      amountINR = await this.getExpectedPrice(productId);
    } else {
      const pack = await this.resolveCreditPack(productId);
      if (pack) {
        credits = pack.credits;
        amountINR = pack.priceINR;
      } else {
        // Legacy static packs (credits_10/50/100).
        amountINR = await this.getExpectedPrice(productId);
        if (amountINR != null) credits = this.calculateCredits(amountINR);
      }
    }
    if (amountINR == null) {
      throw new BadRequestException(`Unknown product: ${productId}`);
    }

    // Validate the token with the Play Developer API.
    let orderId: string;
    let needsAck = false;
    let playMeta: Record<string, unknown> = {};
    if (this.googlePlay) {
      const purchase = await this.googlePlay
        .getProductPurchase(productId, purchaseToken)
        .catch((error) => {
          this.logger.warn(`google verify: token lookup failed: ${(error as Error).message}`);
          return null;
        });
      if (!purchase) {
        throw new BadRequestException('Purchase token could not be validated with Google Play');
      }
      if (purchase.purchaseState !== 0) {
        throw new BadRequestException('Purchase is not in a purchased state');
      }
      orderId = purchase.orderId || `gp_${sha256Hex(purchaseToken).slice(0, 40)}`;
      needsAck = purchase.acknowledgementState === 0;
      playMeta = {
        playRegionCode: purchase.regionCode,
        playPurchaseTimeMillis: purchase.purchaseTimeMillis,
      };
    } else if (process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException('Google Play verification is not configured');
    } else {
      orderId = dto.orderId || `gp_mock_${sha256Hex(purchaseToken).slice(0, 32)}`;
    }

    // Record the payment keyed on the UNIQUE Play orderId (+ token hash as the
    // unique gatewayPaymentId) — a replayed token hits P2002 and is treated as
    // already-recorded; the status-guarded settle below then makes the grant
    // exactly-once. Amount is our authoritative INR price (Play's regional
    // price lives in metadata only).
    const tokenHash = `gp_${sha256Hex(purchaseToken)}`;
    try {
      await this.prisma.payment.create({
        data: {
          userId,
          amount: amountINR,
          currency: 'INR',
          status: 'PENDING',
          gatewayOrderId: orderId,
          gatewayPaymentId: tokenHash,
          provider: 'google_play',
          type: entType ? 'REPORT' : 'CREDITS',
          metadata: {
            productId,
            source: 'google_play',
            kind: entType ? 'entitlement' : 'credits',
            ...(credits ? { credits } : {}),
            ...(entType ? { entitlementType: entType } : {}),
            ...playMeta,
          },
        },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      // Duplicate orderId/token: fine if it's this user's replay, hostile if
      // someone is replaying another account's token.
      const existing = await this.prisma.payment.findFirst({
        where: { gatewayOrderId: orderId },
        select: { userId: true },
      });
      if (existing && existing.userId !== userId) {
        throw new BadRequestException('Purchase belongs to another account');
      }
    }

    const settled = await this.settlePaidOrder(orderId, { userId });

    // Acknowledge so Play doesn't auto-refund the purchase (~3 days). Failing
    // to ack is retried implicitly: the client may re-verify, and RTDN resends.
    if (needsAck && this.googlePlay) {
      await this.googlePlay
        .acknowledgeProduct(productId, purchaseToken)
        .catch((error) =>
          this.logger.warn(`google verify: acknowledge failed: ${(error as Error).message}`),
        );
    }

    const row = await this.prisma.payment.findFirst({
      where: { gatewayOrderId: orderId, userId },
      select: { id: true },
    });
    return {
      verified: true,
      paymentId: row?.id ?? '',
      orderId,
      ...(settled.creditsAdded > 0 ? { creditsAdded: settled.creditsAdded } : {}),
      ...(settled.entitlementGranted ? { entitlementGranted: true } : {}),
    };
  }

  private async verifyGoogleSubscription(
    userId: string,
    dto: GoogleVerifyDto,
  ): Promise<PaymentVerificationResult> {
    const plan = GOOGLE_SUB_PLANS[dto.productId];
    if (!plan) {
      throw new BadRequestException(`Unknown subscription product: ${dto.productId}`);
    }

    let expiry: Date | null = null;
    let needsAck = false;
    if (this.googlePlay) {
      const sub = await this.googlePlay
        .getSubscriptionPurchase(dto.purchaseToken)
        .catch((error) => {
          this.logger.warn(`google verify: sub lookup failed: ${(error as Error).message}`);
          return null;
        });
      if (!sub) {
        throw new BadRequestException('Subscription token could not be validated with Google Play');
      }
      const state = String(sub.subscriptionState ?? '');
      if (!['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(state)) {
        throw new BadRequestException('Subscription is not active');
      }
      expiry = parseDateOrNull(sub.lineItems?.[0]?.expiryTime);
      needsAck = sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING';
    } else if (process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException('Google Play verification is not configured');
    }

    // Our Subscription row is keyed on the purchase token (Play's stable
    // subscription identity); create it once, then run the shared idempotent
    // activation (sets ACTIVE + PREMIUM + rolls endDate).
    const existing = await this.prisma.subscription.findFirst({
      where: { gatewaySubscriptionId: dto.purchaseToken },
      select: { userId: true },
    });
    if (existing && existing.userId !== userId) {
      throw new BadRequestException('Subscription belongs to another account');
    }
    if (!existing) {
      await this.prisma.subscription.create({
        data: {
          userId,
          plan,
          status: 'PENDING',
          provider: 'google_play',
          gatewaySubscriptionId: dto.purchaseToken,
          ...(expiry ? { endDate: expiry } : {}),
        },
      });
    }
    await this.activateSubscription(dto.purchaseToken, expiry);

    if (needsAck && this.googlePlay) {
      await this.googlePlay
        .acknowledgeSubscription(dto.productId, dto.purchaseToken)
        .catch((error) =>
          this.logger.warn(`google verify: sub acknowledge failed: ${(error as Error).message}`),
        );
    }

    return { verified: true, paymentId: '', orderId: dto.purchaseToken };
  }

  /**
   * Google Play Real-time Developer Notifications (Pub/Sub push). Auth is a
   * shared token in the query string, compared constant-time and fail-closed
   * when unconfigured — the RTDN analogue of the Cashfree signature guards.
   * Payload is the base64 DeveloperNotification inside the Pub/Sub envelope.
   * Unknown/irrelevant notification types are acked (200) without side effects
   * so Pub/Sub doesn't retry forever.
   */
  async handleGoogleRtdn(
    envelope: Record<string, any>,
    token: string | undefined,
  ): Promise<{ received: boolean }> {
    const expected = this.configService.get<string>('googlePlay.rtdnToken');
    if (!expected) {
      this.recordWebhookOutcome('rtdn_no_secret');
      throw new InternalServerErrorException('RTDN token not configured');
    }
    if (!token || !timingSafeEqualStr(token, expected)) {
      this.recordWebhookOutcome('rtdn_bad_token');
      throw new UnauthorizedException('Invalid RTDN token');
    }

    const data64 = envelope?.message?.data;
    if (typeof data64 !== 'string' || !data64) {
      this.recordWebhookOutcome('rtdn_bad_envelope');
      return { received: true };
    }
    let notif: any;
    try {
      notif = JSON.parse(Buffer.from(data64, 'base64').toString('utf8'));
    } catch {
      this.recordWebhookOutcome('rtdn_bad_payload');
      return { received: true };
    }

    try {
      if (notif?.testNotification) {
        this.recordWebhookOutcome('ok');
        return { received: true };
      }
      const sub = notif?.subscriptionNotification;
      if (sub?.purchaseToken) {
        await this.handleGoogleSubscriptionNotification(sub);
        this.recordWebhookOutcome('ok');
        return { received: true };
      }
      const voided = notif?.voidedPurchaseNotification;
      if (voided) {
        await this.handleGoogleVoidedPurchase(voided);
        this.recordWebhookOutcome('ok');
        return { received: true };
      }
      if (notif?.oneTimeProductNotification) {
        // Grants happen through client verify (+ reconcile via re-verify);
        // voids/refunds arrive as voidedPurchaseNotification. Ack only.
        this.recordWebhookOutcome('ok');
        return { received: true };
      }
      this.recordWebhookOutcome('rtdn_unknown_type');
      return { received: true };
    } catch (error) {
      // Never bubble processing errors into a Pub/Sub retry storm for
      // deliveries we already authenticated; log + alert instead.
      this.logger.error(`RTDN processing failed: ${(error as Error).message}`);
      this.recordWebhookOutcome('rtdn_processing_error');
      return { received: true };
    }
  }

  /** RTDN notificationType → subscription lifecycle. Mirrors the Cashfree
   *  status-change handler's "err toward revoking access" policy. */
  private async handleGoogleSubscriptionNotification(sub: {
    notificationType?: number;
    purchaseToken: string;
  }): Promise<void> {
    const t = Number(sub.notificationType);
    const ACTIVATE = [1, 2, 4, 6, 7]; // RECOVERED, RENEWED, PURCHASED, IN_GRACE_PERIOD, RESTARTED
    const CANCELLED = [3]; // CANCELED
    const TERMINAL = [5, 10, 12, 13]; // ON_HOLD, PAUSED, REVOKED, EXPIRED

    if (ACTIVATE.includes(t)) {
      let expiry: Date | null = null;
      if (this.googlePlay) {
        const s = await this.googlePlay
          .getSubscriptionPurchase(sub.purchaseToken)
          .catch(() => null);
        expiry = parseDateOrNull(s?.lineItems?.[0]?.expiryTime);
      }
      await this.activateSubscription(sub.purchaseToken, expiry);
    } else if (CANCELLED.includes(t)) {
      await this.terminateSubscription(sub.purchaseToken, 'CANCELLED');
    } else if (TERMINAL.includes(t)) {
      await this.terminateSubscription(sub.purchaseToken, 'EXPIRED');
    }
    // Other types (price change confirmed, deferred, pause scheduled) are
    // informational — no state change.
  }

  /** Voided-purchase clawback. productType 1 = subscription, 2 = one-time. The
   *  one-time path reuses the provider-agnostic guarded reversal in
   *  `handleRefund` (it keys on gatewayOrderId, which for Play is the GPA
   *  order id we stored at verify time). */
  private async handleGoogleVoidedPurchase(voided: {
    purchaseToken?: string;
    orderId?: string;
    productType?: number;
  }): Promise<void> {
    if (voided.productType === 1 && voided.purchaseToken) {
      await this.terminateSubscription(voided.purchaseToken, 'CANCELLED');
      return;
    }
    if (voided.orderId) {
      await this.handleRefund({
        refund: { refund_status: 'SUCCESS', order_id: voided.orderId },
      });
    }
  }

  /**
   * The current user's subscription for the profile billing card: the active
   * one if present, else the most recent. Null when the user never subscribed.
   */
  async getMySubscription(userId: string): Promise<MySubscription | null> {
    const now = new Date();
    const active = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', OR: [{ endDate: null }, { endDate: { gt: now } }] },
      orderBy: { startDate: 'desc' },
    });
    const sub =
      active ??
      (await this.prisma.subscription.findFirst({
        where: { userId },
        orderBy: { startDate: 'desc' },
      }));
    if (!sub) return null;
    return {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate ? sub.endDate.toISOString() : null,
      provider: sub.provider ?? null,
      active: !!active,
      cancellable: !!active,
    };
  }

  /**
   * User-initiated cancel of their own subscription(s). Cancels the mandate at
   * the gateway first (so no further charges), then marks the row CANCELLED and
   * revokes PREMIUM if no other subscription is still active. Immediate (mirrors
   * the admin cancel). Idempotent with the SUBSCRIPTION_STATUS_CHANGE webhook
   * Cashfree sends afterwards. Throws 400 when there's nothing to cancel.
   */
  async cancelSubscriptionForUser(userId: string): Promise<{ cancelled: boolean }> {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: 'ACTIVE', OR: [{ endDate: null }, { endDate: { gt: now } }] },
    });
    if (subs.length === 0) {
      throw new BadRequestException('You have no active subscription to cancel.');
    }

    // Cancel at the gateway FIRST for gateway-backed subs. If that fails we abort
    // without touching local state — never report "cancelled" while the gateway
    // could still charge. Local-only grants (e.g. referral bonuses) skip this.
    for (const sub of subs) {
      if (sub.provider === 'google_play') {
        // Play subscriptions are managed by Google. The server has no way to stop
        // billing here, and marking the row CANCELLED locally is futile: the next
        // RTDN RENEWED reactivates it while Google keeps charging — the user would
        // think they cancelled while still being billed. Direct them to the Play
        // Store subscription center (the only place an Android sub can be stopped).
        throw new BadRequestException(
          'This subscription is billed through Google Play. Cancel it in the Play Store: Payments & subscriptions → Subscriptions.',
        );
      }
      if (this.cashfree && sub.provider === 'cashfree' && sub.gatewaySubscriptionId) {
        try {
          await this.cashfree.manageSubscription(sub.gatewaySubscriptionId, { action: 'CANCEL' });
        } catch (err) {
          this.logger.error(
            `Cashfree cancel failed for subscription ${sub.gatewaySubscriptionId}`,
            err as Error,
          );
          throw new InternalServerErrorException(
            'Could not cancel your subscription with the payment provider. Please try again.',
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.subscription.updateMany({
        where: { id: { in: subs.map((s) => s.id) } },
        data: { status: 'CANCELLED', endDate: now },
      });
      await this.revokePremiumIfNoActiveSub(tx, userId);
    });
    this.logger.log(`User ${userId} cancelled ${subs.length} subscription(s)`);
    return { cancelled: true };
  }

  async getPaymentHistory(userId: string): Promise<PaymentHistoryItem[]> {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return payments.map((p: any) => ({
      id: p.id,
      orderId: p.gatewayOrderId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      type: p.type,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async getPricingConfig(): Promise<Record<string, string>> {
    // Pull every pricing.* key plus the monetization feature flags and the
    // social-proof seed in one round trip, so the public web surface can read
    // prices, mode flags, and the report counter from this single endpoint
    // without auth.
    const featureKeys = [
      'feature.subscriptions_enabled',
      'feature.pricing_page_enabled',
      'feature.free_mode',
      'feature.credits_enabled',
      'feature.overage_for_free_enabled',
    ];
    const socialKeys = ['social.report_count_base'];
    // App-store policy knobs (admin-tunable). The mobile app hides its "buy on
    // the web" link unless allowWebCheckoutLink is exactly 'true' — absent or
    // anything else means hidden (fail-closed anti-steering; India default).
    const storeKeys = ['store.region_mode', 'store.allow_web_checkout_link'];
    const rows = await this.prisma.siteSetting.findMany({
      where: {
        OR: [
          { key: { startsWith: 'pricing.' } },
          { key: { startsWith: 'limits.' } },
          { key: { in: [...featureKeys, ...socialKeys, ...storeKeys] } },
        ],
      },
    });
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    // Surface store policy under stable storePolicy.* keys (raw store.* keys
    // stay internal). Defaults: region IN, web-checkout link hidden.
    result['storePolicy.region'] = result['store.region_mode'] || 'IN';
    result['storePolicy.allowWebCheckoutLink'] =
      result['store.allow_web_checkout_link'] === 'true' ? 'true' : 'false';
    delete result['store.region_mode'];
    delete result['store.allow_web_checkout_link'];

    if (result['feature.subscriptions_enabled'] === undefined) result['feature.subscriptions_enabled'] = 'false';
    if (result['feature.pricing_page_enabled'] === undefined) result['feature.pricing_page_enabled'] = 'false';
    if (result['feature.free_mode'] === undefined) result['feature.free_mode'] = 'false';
    // Credits default ON (legacy-safe) when unset — mirrors FeatureAccessService.
    if (result['feature.credits_enabled'] === undefined) result['feature.credits_enabled'] = 'true';
    if (result['feature.overage_for_free_enabled'] === undefined) result['feature.overage_for_free_enabled'] = 'false';
    if (result['pricing.report.price'] === undefined) result['pricing.report.price'] = String(DEFAULT_REPORT_PRICE_INR);
    if (result['pricing.palmistry.price'] === undefined) result['pricing.palmistry.price'] = String(DEFAULT_PALMISTRY_PRICE_INR);

    // Social proof: seed base + real successful report purchases.
    const base = parseInt(result['social.report_count_base'] ?? '', 10);
    const seed = Number.isFinite(base) && base > 0 ? base : 41345;
    const sold = await this.prisma.payment.count({
      where: { type: 'REPORT', status: 'SUCCESS' },
    });
    result['social.reports_delivered'] = String(seed + sold);

    return result;
  }

  /**
   * Credits to grant for a completed payment. Prefers the `credits` value
   * captured in the payment metadata at order-creation time (the authoritative
   * pack definition). Falls back to the amount-based heuristic for legacy
   * payments created before packs stored their credit count.
   */
  private creditsForPayment(payment: { amount: unknown; metadata?: unknown }): number {
    const meta = (payment?.metadata ?? null) as { credits?: unknown } | null;
    const metaCredits =
      meta && typeof meta.credits === 'number' && Number.isFinite(meta.credits) && meta.credits > 0
        ? meta.credits
        : null;
    // Grant ONLY what the order explicitly recorded as credits. A payment with
    // no positive `credits` in metadata (an unknown/custom-amount order such as
    // a donation) grants nothing — never infer credits from the paid amount,
    // which would let any caller mint credits with an arbitrary id + amount.
    return metaCredits ?? 0;
  }

  /**
   * Revoke Premium when a subscription ends, but only if the user has no OTHER
   * still-active subscription, and only for a currently-PREMIUM user (the
   * `role: 'PREMIUM'` guard leaves ADMIN accounts and already-downgraded users
   * untouched). Runs inside the caller's transaction.
   */
  private async revokePremiumIfNoActiveSub(tx: any, userId: string): Promise<void> {
    const activeCount = await tx.subscription.count({
      where: { userId, status: 'ACTIVE' },
    });
    if (activeCount > 0) return;
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

/** Parse a Cashfree date/expiry value into a Date, or null if absent/invalid. */
function parseDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}
