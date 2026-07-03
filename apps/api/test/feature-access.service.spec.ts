import { Test, TestingModule } from '@nestjs/testing';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { PaymentRequiredException } from '../src/common/exceptions/payment-required.exception';
import { PrismaService } from '../src/prisma/prisma.service';

describe('FeatureAccessService', () => {
  let service: FeatureAccessService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      siteSetting: { findUnique: jest.fn() },
      subscription: { count: jest.fn() },
      entitlement: { count: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      usageCounter: { findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
      $queryRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureAccessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FeatureAccessService>(FeatureAccessService);
  });

  describe('subscriptionsEnabled', () => {
    it('defaults to false when the flag is unset', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue(null);
      expect(await service.subscriptionsEnabled()).toBe(false);
    });

    it('is true only for the literal "true"', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'true' });
      expect(await service.subscriptionsEnabled()).toBe(true);
    });
  });

  describe('isActiveSubscriber', () => {
    it('is always false when subscriptions are disabled (Mode A)', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'false' });
      expect(await service.isActiveSubscriber('u1')).toBe(false);
      expect(prisma.subscription.count).not.toHaveBeenCalled();
    });

    it('checks for an ACTIVE, non-expired subscription when enabled', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'true' });
      prisma.subscription.count.mockResolvedValue(1);
      expect(await service.isActiveSubscriber('u1')).toBe(true);
    });
  });

  describe('getCreditCost', () => {
    it('returns the SiteSetting override when present and valid', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: '7' });
      expect(await service.getCreditCost('deep_dive', 3)).toBe(7);
      expect(prisma.siteSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'pricing.credits.deep_dive_cost' },
      });
    });

    it('falls back to the default when unset', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue(null);
      expect(await service.getCreditCost('chat', 1)).toBe(1);
    });

    it('falls back when the stored value is non-numeric or negative', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'abc' });
      expect(await service.getCreditCost('chat', 1)).toBe(1);
      prisma.siteSetting.findUnique.mockResolvedValue({ value: '-2' });
      expect(await service.getCreditCost('chat', 1)).toBe(1);
    });

    it('allows an explicit zero (free)', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: '0' });
      expect(await service.getCreditCost('chat', 1)).toBe(0);
    });
  });

  describe('resolveUnlock', () => {
    it('returns "subscriber" for an active subscriber', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'true' });
      prisma.subscription.count.mockResolvedValue(1);
      expect(await service.resolveUnlock('u1', 'REPORT_LIFE')).toBe('subscriber');
    });

    it('returns "entitlement" when an unused unlock exists', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'false' });
      prisma.entitlement.count.mockResolvedValue(1);
      expect(await service.resolveUnlock('u1', 'PALMISTRY')).toBe('entitlement');
    });

    it('throws 402 when neither subscription nor entitlement is available', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'false' });
      prisma.entitlement.count.mockResolvedValue(0);
      await expect(service.resolveUnlock('u1', 'PALMISTRY')).rejects.toThrow(PaymentRequiredException);
    });

    it('returns "subscriber" (free) for everyone when the master free switch is on', async () => {
      // feature.free_mode = true short-circuits before any entitlement check.
      prisma.siteSetting.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.key === 'feature.free_mode' ? { value: 'true' } : null),
      );
      prisma.entitlement.count.mockResolvedValue(0);
      expect(await service.resolveUnlock('u1', 'REPORT_LIFE')).toBe('subscriber');
    });
  });

  describe('paidFeaturesFree', () => {
    it('reflects the feature.free_mode flag', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'true' });
      expect(await service.paidFeaturesFree()).toBe(true);
    });
  });

  describe('consumeEntitlement', () => {
    it('throws 402 when no unused entitlement could be claimed', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(service.consumeEntitlement('u1', 'REPORT_LIFE', 'ref-1')).rejects.toThrow(
        PaymentRequiredException,
      );
    });

    it('succeeds when one row is claimed', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'ent-1' }]);
      await expect(service.consumeEntitlement('u1', 'REPORT_LIFE', 'ref-1')).resolves.toBeUndefined();
    });
  });

  describe('grantEntitlement', () => {
    it('treats a duplicate (P2002) grant as idempotent', async () => {
      prisma.entitlement.create.mockRejectedValue({ code: 'P2002' });
      expect(await service.grantEntitlement('u1', 'pay-1', 'REPORT_LIFE')).toBe(false);
    });

    it('returns true on a fresh grant', async () => {
      prisma.entitlement.create.mockResolvedValue({ id: 'ent-1' });
      expect(await service.grantEntitlement('u1', 'pay-1', 'REPORT_LIFE')).toBe(true);
    });
  });

  // ─── Subscription-model: credits switch + usage metering ────────────────────

  describe('creditsEnabled', () => {
    it('defaults to true (legacy-safe) when the flag is unset', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue(null);
      expect(await service.creditsEnabled()).toBe(true);
    });

    it('is false only for the literal "false"', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'false' });
      expect(await service.creditsEnabled()).toBe(false);
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'true' });
      expect(await service.creditsEnabled()).toBe(true);
    });
  });

  describe('getUsageLimit', () => {
    it('reads the admin override per tier', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: '1234' });
      expect(await service.getUsageLimit('chat', true)).toBe(1234);
      expect(prisma.siteSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'limits.chat.subscriber' },
      });
    });

    it('falls back to the built-in default when unset or malformed', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue(null);
      expect(await service.getUsageLimit('chat', false)).toBe(50);
      expect(await service.getUsageLimit('chat', true)).toBe(1000);
      expect(await service.getUsageLimit('palmistry', false)).toBe(2);
      expect(await service.getUsageLimit('palmistry', true)).toBe(4);
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'abc' });
      expect(await service.getUsageLimit('report', true)).toBe(1);
    });
  });

  describe('checkUsage', () => {
    const settings = (map: Record<string, string>) =>
      prisma.siteSetting.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(map[where.key] !== undefined ? { value: map[where.key] } : null),
      );

    it('allows a free user under their LIFETIME allowance', async () => {
      settings({ 'feature.subscriptions_enabled': 'false', 'limits.chat.free': '50' });
      prisma.usageCounter.findUnique.mockResolvedValue({ used: 30, bonus: 0 });
      const r = await service.checkUsage('u1', 'chat');
      expect(r).toMatchObject({
        allowed: true,
        used: 30,
        limit: 50,
        remaining: 20,
        isSubscriber: false,
        periodKey: 'LIFETIME',
      });
    });

    it('blocks a free user at the limit (missing counter row counts as 0)', async () => {
      settings({ 'feature.subscriptions_enabled': 'false', 'limits.palmistry.free': '2' });
      prisma.usageCounter.findUnique.mockResolvedValue({ used: 2, bonus: 0 });
      const r = await service.checkUsage('u1', 'palmistry');
      expect(r.allowed).toBe(false);
      expect(r.remaining).toBe(0);
    });

    it('counts purchased bonus toward the ceiling', async () => {
      settings({ 'feature.subscriptions_enabled': 'false', 'limits.palmistry.free': '2' });
      prisma.usageCounter.findUnique.mockResolvedValue({ used: 2, bonus: 2 });
      const r = await service.checkUsage('u1', 'palmistry');
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(2);
    });

    it('meters a subscriber per calendar month with the subscriber limit', async () => {
      settings({ 'feature.subscriptions_enabled': 'true', 'limits.chat.subscriber': '1000' });
      prisma.subscription.count.mockResolvedValue(1);
      prisma.usageCounter.findUnique.mockResolvedValue({ used: 10, bonus: 0 });
      const r = await service.checkUsage('u1', 'chat');
      expect(r.isSubscriber).toBe(true);
      expect(r.limit).toBe(1000);
      expect(r.periodKey).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('addUsageBonus', () => {
    it('upserts the bonus onto the current period and returns the key', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'false' }); // subscriptions off → free
      prisma.usageCounter.upsert.mockResolvedValue({});
      const key = await service.addUsageBonus('u1', 'chat', 350);
      expect(key).toBe('LIFETIME');
      expect(prisma.usageCounter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_feature_periodKey: { userId: 'u1', feature: 'chat', periodKey: 'LIFETIME' } },
          create: { userId: 'u1', feature: 'chat', periodKey: 'LIFETIME', bonus: 350 },
          update: { bonus: { increment: 350 } },
        }),
      );
    });
  });

  describe('decrementUsage', () => {
    it('decrements only when used > 0 (floors at zero)', async () => {
      prisma.usageCounter.updateMany.mockResolvedValue({ count: 1 });
      await service.decrementUsage('u1', 'palmistry', '2026-06');
      expect(prisma.usageCounter.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', feature: 'palmistry', periodKey: '2026-06', used: { gt: 0 } },
        data: { used: { decrement: 1 } },
      });
    });
  });

  describe('overageForFreeEnabled', () => {
    it('defaults to false and is true only for "true"', async () => {
      prisma.siteSetting.findUnique.mockResolvedValue(null);
      expect(await service.overageForFreeEnabled()).toBe(false);
      prisma.siteSetting.findUnique.mockResolvedValue({ value: 'true' });
      expect(await service.overageForFreeEnabled()).toBe(true);
    });
  });

  describe('checkUsage with a shared limit key (per-type reports)', () => {
    it('reads the counter under `feature` but the limit under `limitFeature`', async () => {
      prisma.siteSetting.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.key === 'feature.subscriptions_enabled'
            ? { value: 'true' }
            : where.key === 'limits.report.subscriber'
              ? { value: '1' }
              : null,
        ),
      );
      prisma.subscription.count.mockResolvedValue(1);
      prisma.usageCounter.findUnique.mockResolvedValue({ used: 0, bonus: 0 });
      const r = await service.checkUsage('u1', 'report_life', 'report');
      expect(r.limit).toBe(1);
      expect(r.allowed).toBe(true);
      // limit fetched under the shared key…
      expect(prisma.siteSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'limits.report.subscriber' } });
      // …counter row keyed by the per-type feature.
      expect(prisma.usageCounter.findUnique).toHaveBeenCalledWith({
        where: { userId_feature_periodKey: { userId: 'u1', feature: 'report_life', periodKey: r.periodKey } },
      });
    });
  });
});
