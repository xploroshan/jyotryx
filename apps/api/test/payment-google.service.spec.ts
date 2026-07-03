import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentService } from '../src/modules/payment/payment.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';

const RTDN_TOKEN = 'test-rtdn-token';

/** Wrap a DeveloperNotification into a Pub/Sub push envelope. */
function rtdnEnvelope(notification: unknown): Record<string, any> {
  return {
    message: { data: Buffer.from(JSON.stringify(notification)).toString('base64') },
    subscription: 'projects/test/subscriptions/rtdn',
  };
}

describe('PaymentService (Google Play)', () => {
  let service: PaymentService;
  let prisma: any;
  let metrics: any;
  let featureAccess: any;
  let playMock: any;

  const USER_ID = 'test-uuid';

  /** Transaction stub whose payment row settles as a credits purchase. */
  function txForCredits(credits: number) {
    return {
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'pay-1',
          userId: USER_ID,
          amount: 99,
          metadata: { credits, kind: 'credits' },
        }),
      },
      user: { update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      creditTransaction: { create: jest.fn() },
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue({ userId: USER_ID, plan: 'MONTHLY', endDate: null }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
  }

  beforeEach(async () => {
    prisma = {
      payment: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'pay-1', userId: USER_ID }),
        count: jest.fn().mockResolvedValue(0),
      },
      subscription: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: USER_ID, credits: 10 }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    featureAccess = {
      grantEntitlement: jest.fn().mockResolvedValue(true),
      voidEntitlementByPayment: jest.fn().mockResolvedValue(0),
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
                // No Cashfree + no Play service account → both mock mode; Play
                // API calls are exercised by injecting playMock below.
                'googlePlay.packageName': 'com.myastro360.app',
                'googlePlay.rtdnToken': RTDN_TOKEN,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        { provide: UserService, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);

    playMock = {
      getProductPurchase: jest.fn(),
      getSubscriptionPurchase: jest.fn(),
      acknowledgeProduct: jest.fn().mockResolvedValue(undefined),
      acknowledgeSubscription: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).googlePlay = playMock;
  });

  // ── verifyGooglePurchase — products ─────────────────────────────────────

  const starterSettings = [
    { key: 'pricing.credits.starter.price', value: '99' },
    { key: 'pricing.credits.starter.credits', value: '50' },
  ];

  it('grants credits exactly once for a valid purchased token', async () => {
    prisma.siteSetting.findMany.mockResolvedValue(starterSettings);
    playMock.getProductPurchase.mockResolvedValue({
      purchaseState: 0,
      acknowledgementState: 0,
      orderId: 'GPA.111',
      regionCode: 'IN',
    });
    const tx = txForCredits(50);
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    const res = await service.verifyGooglePurchase(USER_ID, {
      productId: 'credits_starter',
      purchaseToken: 'tok-1',
      kind: 'product',
    } as any);

    expect(res.verified).toBe(true);
    expect(res.creditsAdded).toBe(50);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'google_play',
          gatewayOrderId: 'GPA.111',
          amount: 99,
          type: 'CREDITS',
        }),
      }),
    );
    // The claim is status-guarded (exactly-once across replays/races).
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'SUCCESS' } }),
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { increment: 50 } } }),
    );
    expect(playMock.acknowledgeProduct).toHaveBeenCalledWith('credits_starter', 'tok-1');
  });

  it('does NOT double-grant a replayed token (P2002 + already-claimed row)', async () => {
    prisma.siteSetting.findMany.mockResolvedValue(starterSettings);
    playMock.getProductPurchase.mockResolvedValue({ purchaseState: 0, orderId: 'GPA.111' });
    prisma.payment.create.mockRejectedValue({ code: 'P2002' });
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', userId: USER_ID });
    const tx = txForCredits(50);
    tx.payment.updateMany.mockResolvedValue({ count: 0 }); // already SUCCESS
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    const res = await service.verifyGooglePurchase(USER_ID, {
      productId: 'credits_starter',
      purchaseToken: 'tok-1',
      kind: 'product',
    } as any);

    expect(res.verified).toBe(true);
    expect(res.creditsAdded).toBeUndefined();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects a token replayed from another account', async () => {
    prisma.siteSetting.findMany.mockResolvedValue(starterSettings);
    playMock.getProductPurchase.mockResolvedValue({ purchaseState: 0, orderId: 'GPA.111' });
    prisma.payment.create.mockRejectedValue({ code: 'P2002' });
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', userId: 'someone-else' });

    await expect(
      service.verifyGooglePurchase(USER_ID, {
        productId: 'credits_starter',
        purchaseToken: 'tok-1',
        kind: 'product',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when Play reports a non-purchased state', async () => {
    prisma.siteSetting.findMany.mockResolvedValue(starterSettings);
    playMock.getProductPurchase.mockResolvedValue({ purchaseState: 2, orderId: 'GPA.2' });

    await expect(
      service.verifyGooglePurchase(USER_ID, {
        productId: 'credits_starter',
        purchaseToken: 'tok-pending',
        kind: 'product',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown SKU before calling Play', async () => {
    await expect(
      service.verifyGooglePurchase(USER_ID, {
        productId: 'credits_bogus',
        purchaseToken: 'tok',
        kind: 'product',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(playMock.getProductPurchase).not.toHaveBeenCalled();
  });

  it('fails closed in production when Play is not configured', async () => {
    (service as any).googlePlay = null;
    prisma.siteSetting.findMany.mockResolvedValue(starterSettings);
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(
        service.verifyGooglePurchase(USER_ID, {
          productId: 'credits_starter',
          purchaseToken: 'tok',
          kind: 'product',
        } as any),
      ).rejects.toThrow(InternalServerErrorException);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('grants a one-time entitlement for an entitlement SKU', async () => {
    playMock.getProductPurchase.mockResolvedValue({ purchaseState: 0, orderId: 'GPA.3' });
    const tx = txForCredits(0);
    tx.payment.findFirstOrThrow = jest.fn().mockResolvedValue({
      id: 'pay-2',
      userId: USER_ID,
      amount: 250,
      metadata: { entitlementType: 'PALMISTRY', kind: 'entitlement' },
    });
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    const res = await service.verifyGooglePurchase(USER_ID, {
      productId: 'palm_reading',
      purchaseToken: 'tok-palm',
      kind: 'product',
    } as any);

    expect(res.entitlementGranted).toBe(true);
    expect(featureAccess.grantEntitlement).toHaveBeenCalledWith(
      USER_ID,
      'pay-2',
      'PALMISTRY',
      expect.anything(),
    );
  });

  // ── verifyGooglePurchase — subscriptions ────────────────────────────────

  it('activates PREMIUM for an active Play subscription', async () => {
    playMock.getSubscriptionPurchase.mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
      lineItems: [{ expiryTime: '2027-01-01T00:00:00Z' }],
    });
    const tx = txForCredits(0);
    tx.subscription.findFirst.mockResolvedValue({ userId: USER_ID, plan: 'MONTHLY', endDate: new Date() });
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    const res = await service.verifyGooglePurchase(USER_ID, {
      productId: 'premium_monthly',
      purchaseToken: 'sub-tok-1',
      kind: 'subscription',
    } as any);

    expect(res.verified).toBe(true);
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'google_play',
          gatewaySubscriptionId: 'sub-tok-1',
          plan: 'MONTHLY',
        }),
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'PREMIUM' } }),
    );
    expect(playMock.acknowledgeSubscription).toHaveBeenCalledWith('premium_monthly', 'sub-tok-1');
  });

  it('rejects a subscription token that belongs to another account', async () => {
    playMock.getSubscriptionPurchase.mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [],
    });
    prisma.subscription.findFirst.mockResolvedValue({ userId: 'someone-else' });

    await expect(
      service.verifyGooglePurchase(USER_ID, {
        productId: 'premium_annual',
        purchaseToken: 'sub-tok-2',
        kind: 'subscription',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown subscription SKU', async () => {
    await expect(
      service.verifyGooglePurchase(USER_ID, {
        productId: 'premium_weekly',
        purchaseToken: 'tok',
        kind: 'subscription',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(playMock.getSubscriptionPurchase).not.toHaveBeenCalled();
  });

  it('rejects a subscription Play reports as expired', async () => {
    playMock.getSubscriptionPurchase.mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED',
    });
    await expect(
      service.verifyGooglePurchase(USER_ID, {
        productId: 'premium_monthly',
        purchaseToken: 'tok-expired',
        kind: 'subscription',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  // ── RTDN ────────────────────────────────────────────────────────────────

  it('fails closed when no RTDN token is configured', async () => {
    const cfg = (service as any).configService;
    const original = cfg.get;
    cfg.get = jest.fn((key: string) => (key === 'googlePlay.rtdnToken' ? '' : original(key)));
    await expect(service.handleGoogleRtdn(rtdnEnvelope({}), RTDN_TOKEN)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(metrics.cashfreeWebhookTotal.inc).toHaveBeenCalledWith({ outcome: 'rtdn_no_secret' });
    cfg.get = original;
  });

  it('rejects a bad RTDN token', async () => {
    await expect(service.handleGoogleRtdn(rtdnEnvelope({}), 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(metrics.cashfreeWebhookTotal.inc).toHaveBeenCalledWith({ outcome: 'rtdn_bad_token' });
  });

  it('acks a test notification without side effects', async () => {
    const res = await service.handleGoogleRtdn(rtdnEnvelope({ testNotification: {} }), RTDN_TOKEN);
    expect(res.received).toBe(true);
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('acks a malformed payload without throwing', async () => {
    const res = await service.handleGoogleRtdn(
      { message: { data: '!!!not-base64-json!!!' } },
      RTDN_TOKEN,
    );
    expect(res.received).toBe(true);
    expect(metrics.cashfreeWebhookTotal.inc).toHaveBeenCalledWith({ outcome: 'rtdn_bad_payload' });
  });

  it('activates the subscription on a RENEWED notification', async () => {
    (service as any).googlePlay = null; // expiry falls back to rolling forward
    const tx = txForCredits(0);
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    await service.handleGoogleRtdn(
      rtdnEnvelope({ subscriptionNotification: { notificationType: 2, purchaseToken: 'sub-tok' } }),
      RTDN_TOKEN,
    );

    expect(tx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gatewaySubscriptionId: 'sub-tok' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'PREMIUM' } }),
    );
  });

  it('terminates and revokes PREMIUM on a REVOKED notification', async () => {
    const tx = txForCredits(0);
    tx.subscription.count = jest.fn().mockResolvedValue(0); // no other active sub
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    await service.handleGoogleRtdn(
      rtdnEnvelope({ subscriptionNotification: { notificationType: 12, purchaseToken: 'sub-tok' } }),
      RTDN_TOKEN,
    );

    expect(tx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } }),
    );
    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'PREMIUM' }),
        data: { role: 'USER' },
      }),
    );
  });

  it('records CANCELLED on a CANCELED notification', async () => {
    const tx = txForCredits(0);
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    await service.handleGoogleRtdn(
      rtdnEnvelope({ subscriptionNotification: { notificationType: 3, purchaseToken: 'sub-tok' } }),
      RTDN_TOKEN,
    );

    expect(tx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } }),
    );
  });

  it('claws back a voided one-time purchase through the guarded refund path', async () => {
    const tx = txForCredits(0);
    tx.payment.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    (tx.payment as any).findFirst = jest.fn().mockResolvedValue({
      id: 'pay-9',
      userId: USER_ID,
      amount: 99,
      metadata: { credits: 50 },
      type: 'CREDITS',
    });
    (tx.user as any).findUnique = jest.fn().mockResolvedValue({ credits: 30 });
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    await service.handleGoogleRtdn(
      rtdnEnvelope({ voidedPurchaseNotification: { orderId: 'GPA.9', productType: 2 } }),
      RTDN_TOKEN,
    );

    // SUCCESS → REFUNDED guarded transition on the stored Play orderId…
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gatewayOrderId: 'GPA.9', status: 'SUCCESS' },
        data: { status: 'REFUNDED' },
      }),
    );
    // …with the clawback clamped at the current balance (30 < 50).
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { decrement: 30 } } }),
    );
  });

  it('terminates the subscription for a voided subscription purchase', async () => {
    const tx = txForCredits(0);
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    await service.handleGoogleRtdn(
      rtdnEnvelope({
        voidedPurchaseNotification: { purchaseToken: 'sub-tok', productType: 1 },
      }),
      RTDN_TOKEN,
    );

    expect(tx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } }),
    );
  });

  // ── storePolicy in pricing ──────────────────────────────────────────────

  it('emits fail-closed storePolicy defaults', async () => {
    const pricing = await service.getPricingConfig();
    expect(pricing['storePolicy.region']).toBe('IN');
    expect(pricing['storePolicy.allowWebCheckoutLink']).toBe('false');
  });

  it("allows the web-checkout link only when the setting is exactly 'true'", async () => {
    prisma.siteSetting.findMany.mockResolvedValue([
      { key: 'store.region_mode', value: 'US' },
      { key: 'store.allow_web_checkout_link', value: 'true' },
    ]);
    const pricing = await service.getPricingConfig();
    expect(pricing['storePolicy.region']).toBe('US');
    expect(pricing['storePolicy.allowWebCheckoutLink']).toBe('true');
    expect(pricing['store.region_mode']).toBeUndefined();
    expect(pricing['store.allow_web_checkout_link']).toBeUndefined();
  });
});
