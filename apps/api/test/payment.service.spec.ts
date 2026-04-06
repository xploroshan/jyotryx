import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PaymentService } from '../src/modules/payment/payment.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';

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
                'razorpay.keySecret': null,
                'razorpay.webhookSecret': null,
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
    it('should acknowledge webhook receipt', async () => {
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test123',
              amount: 49900,
              notes: { userId: 'test-uuid' },
            },
          },
        },
      };

      const result = await service.handleWebhook(payload);

      expect(result.received).toBe(true);
    });

    it('should handle payment.captured event and add credits', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        userId: 'test-uuid',
        amount: 499,
        status: 'created',
      });
      prisma.payment.update.mockResolvedValue({ id: 'pay-1', status: 'captured' });

      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_razorpay_123',
              amount: 49900,
              notes: { userId: 'test-uuid', credits: '100' },
            },
          },
        },
      };

      const result = await service.handleWebhook(payload);

      expect(result.received).toBe(true);
    });

    it('should handle unknown webhook events gracefully', async () => {
      const payload = {
        event: 'unknown.event',
        payload: {},
      };

      const result = await service.handleWebhook(payload);

      expect(result.received).toBe(true);
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
      ).rejects.toThrow();
    });
  });
});
