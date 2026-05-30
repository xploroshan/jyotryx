import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentService } from '../src/modules/payment/payment.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';

const TEST_WEBHOOK_SECRET = 'test-webhook-secret';
function razorpaySig(secret: string, orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}
function webhookBodySig(secret: string, body: unknown): string {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: any;
  let userService: any;

  const mockUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    credits: 10,
    role: 'USER',
  };

  beforeEach(async () => {
    prisma = {
      payment: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      subscription: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn(),
      },
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'pricing.monthly.price', value: '499' },
          { key: 'pricing.annual.price', value: '4999' },
          { key: 'pricing.monthly.credits', value: '100' },
          { key: 'pricing.annual.credits', value: '1500' },
        ]),
      },
    };

    userService = {
      addCredits: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'razorpay.keyId': 'rzp_test_key',
                // Keep a real secret in the test config — the fail-closed
                // paths are exercised explicitly in their own tests below.
                'razorpay.keySecret': TEST_WEBHOOK_SECRET,
                'razorpay.webhookSecret': TEST_WEBHOOK_SECRET,
                'frontend.url': 'http://localhost:3000',
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

  describe('getPricingConfig', () => {
    it('should return pricing settings from database', async () => {
      const result = await service.getPricingConfig();

      expect(result).toBeDefined();
      expect(prisma.siteSetting.findMany).toHaveBeenCalled();
    });

    it('should return settings as key-value pairs', async () => {
      const result = await service.getPricingConfig();

      expect(typeof result).toBe('object');
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for user', async () => {
      const mockPayments = [
        { id: 'pay-1', amount: 499, status: 'captured', createdAt: new Date() },
        { id: 'pay-2', amount: 4999, status: 'captured', createdAt: new Date() },
      ];
      prisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await service.getPaymentHistory('test-uuid');

      expect(result.length).toBe(2);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'test-uuid' },
        }),
      );
    });

    it('should return empty array for user with no payments', async () => {
      prisma.payment.findMany.mockResolvedValue([]);

      const result = await service.getPaymentHistory('test-uuid');

      expect(result).toEqual([]);
    });

    it('should order payments by newest first', async () => {
      prisma.payment.findMany.mockResolvedValue([]);

      await service.getPaymentHistory('test-uuid');

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ createdAt: 'desc' }),
        }),
      );
    });
  });

  describe('handleWebhook', () => {
    it('should reject webhooks without a signature header', async () => {
      await expect(service.handleWebhook({ event: 'payment.captured' })).rejects.toThrow(BadRequestException);
    });

    it('should reject webhooks with an invalid signature', async () => {
      const payload = { event: 'payment.captured', payload: {} };
      await expect(service.handleWebhook(payload, 'bogus')).rejects.toThrow(BadRequestException);
    });

    it('should acknowledge valid webhook receipt', async () => {
      const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_test123', amount: 49900 } } } };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      // No matching payment row → claim count=0, the handler still returns {received:true}.
      prisma.$transaction = jest.fn(async (cb: any) => cb({
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirstOrThrow: jest.fn() },
        user: { update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      }));
      const result = await service.handleWebhook(payload, sig);
      expect(result.received).toBe(true);
    });

    it('should handle payment.captured and grant credits exactly once when the row transitions', async () => {
      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_razorpay_123', amount: 49900, order_id: 'order_abc' } } },
      };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const txStub = {
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirstOrThrow: jest.fn().mockResolvedValue({ userId: 'test-uuid', amount: 499 }),
        },
        user: { update: jest.fn().mockResolvedValue({}) },
        creditTransaction: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.handleWebhook(payload, sig);
      expect(result.received).toBe(true);
      expect(txStub.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { not: 'SUCCESS' } }) }),
      );
      expect(txStub.user.update).toHaveBeenCalledTimes(1);
      expect(txStub.creditTransaction.create).toHaveBeenCalledTimes(1);
    });

    it('should skip the credit grant when the row was already claimed (race loser)', async () => {
      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_razorpay_999', amount: 49900, order_id: 'order_xyz' } } },
      };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const txStub = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findFirstOrThrow: jest.fn() },
        user: { update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.handleWebhook(payload, sig);
      expect(result.received).toBe(true);
      expect(txStub.user.update).not.toHaveBeenCalled();
      expect(txStub.creditTransaction.create).not.toHaveBeenCalled();
      expect(txStub.payment.findFirstOrThrow).not.toHaveBeenCalled();
    });

    it('should acknowledge unknown events without side effects', async () => {
      const payload = { event: 'unknown.event', payload: {} };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const result = await service.handleWebhook(payload, sig);
      expect(result.received).toBe(true);
    });

    it('grants the PREMIUM role only when the subscription is charged', async () => {
      const payload = {
        event: 'subscription.charged',
        payload: { subscription: { entity: { id: 'sub_live_1' } } },
      };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const userUpdate = jest.fn().mockResolvedValue({});
      const txStub = {
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid' }),
        },
        user: { update: userUpdate },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.handleWebhook(payload, sig);
      expect(result.received).toBe(true);
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'PREMIUM' }) }),
      );
    });

    it('does not grant PREMIUM for a charge on an unknown subscription', async () => {
      const payload = {
        event: 'subscription.activated',
        payload: { subscription: { entity: { id: 'sub_not_ours' } } },
      };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const userUpdate = jest.fn();
      const txStub = {
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn(),
        },
        user: { update: userUpdate },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      const result = await service.handleWebhook(payload, sig);
      expect(result.received).toBe(true);
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('rolls the local endDate forward on a renewal charge', async () => {
      const currentEnd = Math.floor(Date.UTC(2027, 0, 1) / 1000);
      const payload = {
        event: 'subscription.charged',
        payload: { subscription: { entity: { id: 'sub_live_1', current_end: currentEnd } } },
      };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const subUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txStub = {
        subscription: { updateMany: subUpdateMany, findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid' }) },
        user: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(payload, sig);
      expect(subUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE', endDate: new Date(currentEnd * 1000) }) }),
      );
    });

    it.each([
      ['subscription.cancelled', 'CANCELLED'],
      ['subscription.halted', 'EXPIRED'],
      ['subscription.completed', 'EXPIRED'],
    ])('revokes PREMIUM on %s when no other active subscription remains', async (event, expectedStatus) => {
      const payload = { event, payload: { subscription: { entity: { id: 'sub_live_1' } } } };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const userUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const subUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txStub = {
        subscription: {
          updateMany: subUpdateMany,
          findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid' }),
          count: jest.fn().mockResolvedValue(0), // no other active subscription
        },
        user: { updateMany: userUpdateMany },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(payload, sig);
      expect(subUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: expectedStatus }) }),
      );
      expect(userUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'test-uuid', role: 'PREMIUM' }),
          data: { role: 'USER' },
        }),
      );
    });

    it('keeps PREMIUM on cancellation when another active subscription remains', async () => {
      const payload = { event: 'subscription.cancelled', payload: { subscription: { entity: { id: 'sub_live_1' } } } };
      const sig = webhookBodySig(TEST_WEBHOOK_SECRET, payload);
      const userUpdateMany = jest.fn();
      const txStub = {
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({ userId: 'test-uuid' }),
          count: jest.fn().mockResolvedValue(1), // a second active subscription
        },
        user: { updateMany: userUpdateMany },
      };
      prisma.$transaction = jest.fn(async (cb: any) => cb(txStub));

      await service.handleWebhook(payload, sig);
      expect(userUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('should reject invalid payment signatures', async () => {
      await expect(
        service.verifyPayment('test-uuid', {
          razorpayOrderId: 'order_123',
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'invalid_signature',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept a valid signature and grant credits once via updateMany', async () => {
      const orderId = 'order_ok';
      const paymentId = 'pay_ok';
      const sig = razorpaySig(TEST_WEBHOOK_SECRET, orderId, paymentId);
      prisma.payment.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.payment.findFirstOrThrow = jest.fn().mockResolvedValue({ amount: 499 });

      const result = await service.verifyPayment('test-uuid', {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
      });

      expect(result.verified).toBe(true);
      expect(result.creditsAdded).toBeGreaterThan(0);
      expect(userService.addCredits).toHaveBeenCalledTimes(1);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { not: 'SUCCESS' } }) }),
      );
    });

    it('should not double-grant credits when the race is lost', async () => {
      const orderId = 'order_race';
      const paymentId = 'pay_race';
      const sig = razorpaySig(TEST_WEBHOOK_SECRET, orderId, paymentId);
      prisma.payment.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-race-1' });

      const result = await service.verifyPayment('test-uuid', {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
      });

      expect(result.verified).toBe(true);
      expect(result.creditsAdded).toBe(0);
      expect(userService.addCredits).not.toHaveBeenCalled();
    });

    it('should fail closed when no Razorpay secret is configured', async () => {
      // Swap the ConfigService mock so every razorpay.* key returns null.
      const reflector = service as any;
      const configService = reflector.configService;
      const originalGet = configService.get;
      configService.get = jest.fn((key: string) => (key.startsWith('razorpay.') ? null : originalGet(key)));
      await expect(
        service.verifyPayment('test-uuid', {
          razorpayOrderId: 'order_no_sec',
          razorpayPaymentId: 'pay_no_sec',
          razorpaySignature: 'whatever',
        }),
      ).rejects.toThrow(InternalServerErrorException);
      configService.get = originalGet;
    });

    it('grants the credit count captured in metadata, not an amount heuristic', async () => {
      const orderId = 'order_pack';
      const paymentId = 'pay_pack';
      const sig = razorpaySig(TEST_WEBHOOK_SECRET, orderId, paymentId);
      prisma.payment.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      // ₹99 would heuristically map to 10 credits, but the pack stored 25.
      prisma.payment.findFirstOrThrow = jest
        .fn()
        .mockResolvedValue({ amount: 99, metadata: { credits: 25, productId: 'credits_starter' } });

      const result = await service.verifyPayment('test-uuid', {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
      });

      expect(result.creditsAdded).toBe(25);
      expect(userService.addCredits).toHaveBeenCalledWith('test-uuid', 25, 'PURCHASE', expect.any(String));
    });
  });

  describe('createOrder', () => {
    beforeEach(() => {
      // Force mock mode so no real Razorpay network call is attempted.
      (service as any).razorpayInstance = null;
      prisma.payment.create = jest.fn().mockResolvedValue({});
      prisma.siteSetting.findMany = jest.fn().mockResolvedValue([
        { key: 'pricing.credits.starter.price', value: '99' },
        { key: 'pricing.credits.starter.credits', value: '25' },
      ]);
    });

    it('rejects an amount that does not match the pack price', async () => {
      await expect(
        service.createOrder('test-uuid', { amount: 100, productId: 'credits_starter' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts the correct amount and persists the advertised credit count', async () => {
      const order = await service.createOrder('test-uuid', {
        amount: 9900, // ₹99 in paise
        productId: 'credits_starter',
      } as any);

      expect(order.amount).toBe(9900);
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ credits: 25, productId: 'credits_starter' }),
          }),
        }),
      );
    });
  });

  describe('createSubscription', () => {
    it('maps a logical plan to a stored subscription in mock mode', async () => {
      (service as any).razorpayInstance = null;
      const subCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction = jest.fn(async (cb: any) =>
        cb({ subscription: { create: subCreate }, user: { update: jest.fn() } }),
      );

      const result = await service.createSubscription('test-uuid', { plan: 'ANNUAL' } as any);

      expect(result.status).toBe('active');
      expect(subCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plan: 'ANNUAL' }) }),
      );
    });

    it('fails closed when live but no plan_id is configured', async () => {
      // Truthy instance => live path, but config has no razorpay.planAnnual.
      (service as any).razorpayInstance = {};
      await expect(
        service.createSubscription('test-uuid', { plan: 'ANNUAL' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
