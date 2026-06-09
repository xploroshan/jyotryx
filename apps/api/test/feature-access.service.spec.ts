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
});
