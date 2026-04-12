import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../src/modules/user/user.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createMockRedis, mockConfigService } from './helpers/mocks';

describe('UserService — Single-SQL Credit Deduction (Item 7)', () => {
  let service: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      creditTransaction: {
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: -5 } }),
      },
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: REDIS_CLIENT, useValue: createMockRedis() },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('deductCredits — atomic CTE', () => {
    it('should return true when deduction succeeds (affected=1)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(1) }]);

      const result = await service.deductCredits('user-1', 3, 'Chat message');

      expect(result).toBe(true);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('should return false when user has insufficient credits (affected=0)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(0) }]);

      const result = await service.deductCredits('user-1', 100, 'Expensive operation');

      expect(result).toBe(false);
    });

    it('should return false when no rows returned', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.deductCredits('user-1', 5, 'Missing user');

      expect(result).toBe(false);
    });

    it('should use single SQL statement (not $transaction)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(1) }]);

      await service.deductCredits('user-1', 1, 'Test');

      // Must use $queryRawUnsafe (single CTE), not $transaction
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should pass correct SQL parameters', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(1) }]);

      await service.deductCredits('user-42', 5, 'Report generation');

      const call = prisma.$queryRawUnsafe.mock.calls[0];
      const sql = call[0] as string;
      // SQL should contain CTE pattern
      expect(sql).toContain('WITH deducted AS');
      expect(sql).toContain('INSERT INTO credit_transactions');
      // Parameters: amount, userId, negAmount, description
      expect(call[1]).toBe(5);         // amount
      expect(call[2]).toBe('user-42'); // userId
      expect(call[3]).toBe(-5);        // negAmount
      expect(call[4]).toBe('Report generation'); // description
    });
  });
});
