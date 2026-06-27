import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentService } from '../src/modules/payment/payment.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';

const TEST_SECRET = 'test-cashfree-secret';

/** Current epoch seconds as a string (the format Cashfree signs over). */
function nowTs(offsetSeconds = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSeconds);
}

/**
 * Reproduce Cashfree's webhook signature: base64(HMAC-SHA256(secret,
 * timestamp + rawBody)). The service falls back to JSON.stringify(payload)
 * for the body outside production (no raw buffer in unit tests), so the test
 * signs over exactly that.
 */
function cashfreeWebhookSig(secret: string, timestamp: string, payload: unknown): string {
  return crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .update(Buffer.from(JSON.stringify(payload)))
    .digest('base64');
}

describe('PaymentService (Cashfree)', () => {
  let service: PaymentService;
  let prisma: any;
  let metrics: any;

  const mockUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    phone: '9876543210',
    credits: 10,
    role: 'USER',
  };

  beforeEach(async () => {
    prisma = {
      payment: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      subscription: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const userService = {
      addCredits: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    const featureAccess = {
      grantEntitlement: jest.fn().mockResolvedValue(true),
      voidEntitlementByPayment: jest.fn().mockResolvedValue(0),
      resolveUnlock: jest.fn(),
      consumeEntitlement: jest.fn(),
      isActiveSubscriber: jest.fn().mockResolvedValue(false),
    };

    metrics = { cashfreeWebhookTotal: { inc: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: MetricsService, useValue: metrics },
        { provide: FeatureAccessService, useValue: featureAccess },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'cashfree.clientId': 'test-client',
                'cashfree.clientSecret': TEST_SECRET,
                'cashfree.webhookSecret': TEST_SECRET,
                'cashfree.mode': 'sandbox',
                'cashfree.apiVersion': '2025-01-01',
                'cashfree.webhookToleranceSeconds': 300,
                frontendUrl: 'http://localhost:3000',
                apiUrl: 'http://localhost:4000/api',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  // ── Webhook signature & replay (adversarial) ──────────────────────────────
  describe('handleWebhook — signature & replay', () => {
    const payload = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: {} };

    it('rejects webhooks without a signature header', async () => {
      await expect(service.handleWebhook(payload, undefined, nowTs())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects webhooks without a timestamp header', async () => {
      await expect(service.handleWebhook(payload, 'anything', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a forged signature (constant-time base64 compare) and records the outcome', async () => {
      const ts = nowTs();
      await expect(service.handleWebhook(payload, 'not-a-valid-signature', ts)).rejects.toThrow(
        BadRequestException,
      );
      expect(metrics.cashfreeWebhookTotal.inc).toHaveBeenCalledWith({ outcome: 'bad_signature' });
    });

    it('rejects a signature valid for a DIFFERENT body (tamper)', async () => {
      const ts = nowTs();
      const sigForOther = cashfreeWebhookSig(TEST_SECRET, ts, { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { x: 1 } });
      await expect(service.handleWebhook(payload, sigForOther, ts)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a replayed webhook whose timestamp is outside the window', async () => {
      const oldTs = nowTs(-400); // 400s in the past, beyond the 300s tolerance
      const sig = cashfreeWebhookSig(TEST_SECRET, oldTs, payload);
      await expect(service.handleWebhook(payload, sig, oldTs)).rejects.toThrow(
        /timestamp outside allowed window/i,
      );
    });

    it('fails closed when no Cashfree secret is configured', async () => {
      const configService = (service as any).configService;
      const originalGet = configService.get;
      configService.get = jest.fn((key: string) =>
        key.startsWith('cashfree.') ? null : originalGet(key),
      );
      const ts = nowTs();
      await expect(service.handleWebhook(payload, 'sig', ts)).rejects.toThrow(
        InternalServerErrorException,
      );
      configService.get = originalGet;
    });

    it('acknowledges an unknown event type without side effects', async () => {
      const p = { type: 'SOME_UNKNOWN_EVENT', data: {} };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const result = await service.handleWebhook(p, sig, ts);
      expect(result.received).toBe(true);
      expect(metrics.cashfreeWebhookTotal.inc).toHaveBeenCalledWith({ outcome: 'ok' });
    });
  });

  // ── Payment success / failure webhooks ────────────────────────────────────
  describe('handleWebhook — payments', () => {
    it('grants credits exactly once when the row transitions (PAYMENT_SUCCESS_WEBHOOK)', async () => {
      const p = {
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        data: { order: { order_id: 'cf_order_1' }, payment: { cf_payment_id: 99001 } },
      };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const txStub = {
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'p1', userId: 'test-uuid', amount: 99, metadata: { credits: 25 } }),
        },
        user: { update: jest.fn().mockResolvedValue({}) },
        creditTransaction: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.handleWebhook(p, sig, ts);
      expect(result.received).toBe(true);
      expect(txStub.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { not: 'SUCCESS' } }) }),
      );
      expect(txStub.user.update).toHaveBeenCalledTimes(1);
      expect(txStub.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { credits: { increment: 25 } } }),
      );
    });

    it('does NOT double-grant when the row was already claimed (race loser)', async () => {
      const p = {
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        data: { order: { order_id: 'cf_order_2' }, payment: { cf_payment_id: 99002 } },
      };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const txStub = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirstOrThrow: jest.fn() },
        user: { update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.handleWebhook(p, sig, ts);
      expect(result.received).toBe(true);
      expect(txStub.user.update).not.toHaveBeenCalled();
      expect(txStub.payment.findFirstOrThrow).not.toHaveBeenCalled();
    });

    it('marks a pending payment FAILED on PAYMENT_FAILED_WEBHOOK', async () => {
      const p = { type: 'PAYMENT_FAILED_WEBHOOK', data: { order: { order_id: 'cf_order_3' } } };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      await service.handleWebhook(p, sig, ts);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gatewayOrderId: 'cf_order_3',
            status: { notIn: ['SUCCESS', 'REFUNDED'] },
          }),
          data: { status: 'FAILED' },
        }),
      );
    });
  });

  // ── Refunds ───────────────────────────────────────────────────────────────
  describe('handleWebhook — refunds', () => {
    function refundPayload(orderId: string) {
      return {
        type: 'REFUND_STATUS_WEBHOOK',
        data: { refund: { refund_status: 'SUCCESS', order_id: orderId, cf_payment_id: 1234 } },
      };
    }

    it('marks REFUNDED and claws back granted credits (clamped at balance)', async () => {
      const p = refundPayload('cf_order_r1');
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const userUpdate = jest.fn().mockResolvedValue({});
      const ctCreate = jest.fn().mockResolvedValue({});
      const txStub = {
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ id: 'p1', userId: 'test-uuid', amount: 99, metadata: { credits: 10 }, type: 'CREDITS' }),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ credits: 4 }), update: userUpdate },
        creditTransaction: { create: ctCreate },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(p, sig, ts);
      // Only 4 credits remain — clamp the 10-credit clawback to 4.
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { credits: { decrement: 4 } } }),
      );
      expect(ctCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: -4, type: 'PURCHASE' }) }),
      );
    });

    it('voids the entitlement (not credits) when refunding a one-time unlock', async () => {
      const featureAccess = (service as any).featureAccess;
      const p = refundPayload('cf_order_r2');
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const userUpdate = jest.fn();
      const txStub = {
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ id: 'p2', userId: 'test-uuid', amount: 199, metadata: null, type: 'REPORT' }),
        },
        user: { findUnique: jest.fn(), update: userUpdate },
        creditTransaction: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(p, sig, ts);
      expect(featureAccess.voidEntitlementByPayment).toHaveBeenCalledWith('p2', txStub);
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('is idempotent — a redelivered refund that claims nothing reverses nothing', async () => {
      const p = refundPayload('cf_order_r3');
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const findFirst = jest.fn();
      const txStub = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirst },
        user: { findUnique: jest.fn(), update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.handleWebhook(p, sig, ts);
      expect(result).toEqual({ received: true });
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('ignores a non-SUCCESS refund status', async () => {
      const p = { type: 'REFUND_STATUS_WEBHOOK', data: { refund: { refund_status: 'PENDING', order_id: 'cf_x' } } };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      prisma.$transaction = jest.fn();
      await service.handleWebhook(p, sig, ts);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── Subscriptions ─────────────────────────────────────────────────────────
  describe('handleWebhook — subscriptions', () => {
    it('grants PREMIUM when a subscription becomes ACTIVE', async () => {
      const p = {
        type: 'SUBSCRIPTION_STATUS_CHANGE',
        data: { subscription_id: 'sub_1', subscription_status: 'ACTIVE' },
      };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const userUpdate = jest.fn().mockResolvedValue({});
      const txStub = {
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid', plan: 'MONTHLY', endDate: null }),
        },
        user: { update: userUpdate },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(p, sig, ts);
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'PREMIUM' } }),
      );
    });

    it('grants PREMIUM on a successful subscription charge event', async () => {
      const p = {
        type: 'SUBSCRIPTION_NEW_PAYMENT',
        data: { subscription_id: 'sub_2', payment_status: 'SUCCESS' },
      };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const userUpdate = jest.fn().mockResolvedValue({});
      const txStub = {
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid', plan: 'ANNUAL', endDate: null }),
        },
        user: { update: userUpdate },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(p, sig, ts);
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'PREMIUM' } }),
      );
    });

    it('revokes PREMIUM on CANCELLED when no other active subscription remains', async () => {
      const p = {
        type: 'SUBSCRIPTION_STATUS_CHANGE',
        data: { subscription_id: 'sub_3', subscription_status: 'CANCELLED' },
      };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const userUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txStub = {
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid' }),
          count: jest.fn().mockResolvedValue(0),
        },
        user: { updateMany: userUpdateMany },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(p, sig, ts);
      expect(userUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'test-uuid', role: 'PREMIUM' }),
          data: { role: 'USER' },
        }),
      );
    });

    it('keeps PREMIUM on cancel when another active subscription remains', async () => {
      const p = {
        type: 'SUBSCRIPTION_STATUS_CHANGE',
        data: { subscription_id: 'sub_4', subscription_status: 'CANCELLED' },
      };
      const ts = nowTs();
      const sig = cashfreeWebhookSig(TEST_SECRET, ts, p);
      const userUpdateMany = jest.fn();
      const txStub = {
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid' }),
          count: jest.fn().mockResolvedValue(1),
        },
        user: { updateMany: userUpdateMany },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(p, sig, ts);
      expect(userUpdateMany).not.toHaveBeenCalled();
    });
  });

  // ── verifyPayment (server-authoritative order-status check) ───────────────
  describe('verifyPayment', () => {
    function stubCashfree(order: any) {
      (service as any).cashfree = { getOrder: jest.fn().mockResolvedValue(order) };
    }

    it('grants credits when Cashfree reports PAID and the amount matches', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'p1', amount: 99 });
      stubCashfree({ order_status: 'PAID', order_amount: 99, cf_order_id: 555 });
      const txStub = {
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'p1', amount: 99, metadata: { credits: 25 } }),
        },
        user: { update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.verifyPayment('test-uuid', { orderId: 'cf_order_ok' });
      expect(result.verified).toBe(true);
      expect(result.creditsAdded).toBe(25);
      expect(txStub.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { credits: { increment: 25 } } }),
      );
    });

    it('REJECTS when Cashfree settled a DIFFERENT amount than persisted (tamper)', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'p1', amount: 99 });
      // Attacker created the order for ₹99 but only paid ₹1.
      stubCashfree({ order_status: 'PAID', order_amount: 1, cf_order_id: 1 });
      prisma.$transaction = jest.fn();

      await expect(service.verifyPayment('test-uuid', { orderId: 'cf_tamper' })).rejects.toThrow(
        /amount mismatch/i,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does NOT grant when the order is not PAID yet', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'p1', amount: 99 });
      stubCashfree({ order_status: 'ACTIVE', order_amount: 99 });
      prisma.$transaction = jest.fn();

      const result = await service.verifyPayment('test-uuid', { orderId: 'cf_unpaid' });
      expect(result.verified).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an order that does not belong to the user', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(service.verifyPayment('test-uuid', { orderId: 'cf_not_mine' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('is idempotent — a second verify on an already-claimed order grants nothing', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'p1', amount: 99 });
      stubCashfree({ order_status: 'PAID', order_amount: 99 });
      const txStub = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirstOrThrow: jest.fn() },
        user: { update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.verifyPayment('test-uuid', { orderId: 'cf_dupe' });
      expect(result.verified).toBe(true);
      expect(result.creditsAdded).toBe(0);
      expect(txStub.user.update).not.toHaveBeenCalled();
    });

    it('fails closed in production when Cashfree is not configured', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 'p1', amount: 99 });
      (service as any).cashfree = null;
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(service.verifyPayment('test-uuid', { orderId: 'cf_x' })).rejects.toThrow(
          InternalServerErrorException,
        );
      } finally {
        process.env.NODE_ENV = prev;
      }
    });
  });

  // ── createOrder (server-side amount authority) ────────────────────────────
  describe('createOrder', () => {
    beforeEach(() => {
      // Mock mode: no Cashfree client → no network call.
      (service as any).cashfree = null;
      prisma.payment.create = jest.fn().mockResolvedValue({});
      prisma.siteSetting.findMany = jest.fn().mockResolvedValue([
        { key: 'pricing.credits.starter.price', value: '99' },
        { key: 'pricing.credits.starter.credits', value: '25' },
      ]);
    });

    it('rejects an amount that does not match the pack price (in rupees)', async () => {
      await expect(
        service.createOrder('test-uuid', { amount: 1, productId: 'credits_starter' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts the correct rupee amount and persists the advertised credit count', async () => {
      const order = await service.createOrder('test-uuid', {
        amount: 99, // rupees, not paise
        productId: 'credits_starter',
      } as any);

      expect(order.amount).toBe(99);
      expect(order.orderId).toMatch(/^cf_/);
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'cashfree',
            metadata: expect.objectContaining({ credits: 25, productId: 'credits_starter' }),
          }),
        }),
      );
    });
  });

  // ── createSubscription ────────────────────────────────────────────────────
  describe('createSubscription', () => {
    it('maps a logical plan to a stored PENDING subscription and grants in mock mode', async () => {
      (service as any).cashfree = null; // mock mode grants immediately
      const subCreate = jest.fn().mockResolvedValue({});
      const userUpdate = jest.fn();
      prisma.$transaction = jest.fn(async (cb: any) =>
        cb({ subscription: { create: subCreate }, user: { update: userUpdate } }),
      );

      const result = await service.createSubscription('test-uuid', { plan: 'ANNUAL' } as any);
      expect(result.id).toMatch(/^sub_/);
      expect(subCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'ANNUAL', provider: 'cashfree', status: 'ACTIVE' }),
        }),
      );
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'PREMIUM' } }),
      );
    });

    it('fails closed when live but no plan_id is configured', async () => {
      (service as any).cashfree = { createSubscription: jest.fn() };
      await expect(
        service.createSubscription('test-uuid', { plan: 'ANNUAL' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('refuses to mint a second subscription when one is already active', async () => {
      (prisma.subscription.count as jest.Mock).mockResolvedValueOnce(1);
      (service as any).cashfree = null;
      await expect(
        service.createSubscription('test-uuid', { plan: 'ANNUAL' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── reconcilePendingPayments (missed-webhook safety net) ──────────────────
  describe('reconcilePendingPayments', () => {
    it('settles a missed-webhook PENDING order exactly once', async () => {
      (service as any).cashfree = {
        getOrder: jest.fn().mockResolvedValue({ order_status: 'PAID', order_amount: 99, cf_order_id: 7 }),
      };
      prisma.payment.findMany.mockResolvedValue([{ gatewayOrderId: 'cf_stale_1', amount: 99 }]);
      const txStub = {
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'p1', userId: 'test-uuid', amount: 99, metadata: { credits: 25 } }),
        },
        user: { update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const res = await service.reconcilePendingPayments();
      expect(res.settled).toBe(1);
      expect(txStub.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { credits: { increment: 25 } } }),
      );
    });

    it('does NOT settle when Cashfree reports a different amount (tamper)', async () => {
      (service as any).cashfree = {
        getOrder: jest.fn().mockResolvedValue({ order_status: 'PAID', order_amount: 1 }),
      };
      prisma.payment.findMany.mockResolvedValue([{ gatewayOrderId: 'cf_stale_bad', amount: 99 }]);
      prisma.$transaction = jest.fn();

      const res = await service.reconcilePendingPayments();
      expect(res.settled).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('marks an expired stale order FAILED', async () => {
      (service as any).cashfree = {
        getOrder: jest.fn().mockResolvedValue({ order_status: 'EXPIRED' }),
      };
      prisma.payment.findMany.mockResolvedValue([{ gatewayOrderId: 'cf_stale_2', amount: 99 }]);
      prisma.payment.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      const res = await service.reconcilePendingPayments();
      expect(res.settled).toBe(0);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FAILED' } }),
      );
    });

    it('no-ops in mock mode (no Cashfree client)', async () => {
      (service as any).cashfree = null;
      const res = await service.reconcilePendingPayments();
      expect(res).toEqual({ checked: 0, settled: 0 });
    });
  });

  // ── getPaymentHistory ─────────────────────────────────────────────────────
  describe('getPaymentHistory', () => {
    it('maps gatewayOrderId into the orderId field', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', gatewayOrderId: 'cf_o1', amount: 99, currency: 'INR', status: 'SUCCESS', type: 'CREDITS', createdAt: new Date() },
      ]);
      const result = await service.getPaymentHistory('test-uuid');
      expect(result[0].orderId).toBe('cf_o1');
    });
  });
});
