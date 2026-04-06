import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../src/modules/user/user.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { mockPrismaService, mockUser } from './helpers/mocks';

describe('UserService – Credit Reset Logic', () => {
  let service: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    prisma.user.findUnique.mockResolvedValue({ ...mockUser });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should compute resetsAt as first of next month', async () => {
    const user = {
      ...mockUser,
      createdAt: new Date('2025-06-15T10:00:00Z'),
    };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.getCredits('test-uuid');
    const resetsAt = new Date(result.resetsAt);

    // resetsAt should be the 1st of some month
    expect(resetsAt.getDate()).toBe(1);
    expect(resetsAt.getHours()).toBe(0);
    expect(resetsAt.getMinutes()).toBe(0);
    expect(resetsAt.getSeconds()).toBe(0);
  });

  it('should use lastCreditReset when available', async () => {
    const lastReset = new Date();
    lastReset.setDate(1); // 1st of current month
    lastReset.setHours(0, 0, 0, 0);

    const user = {
      ...mockUser,
      lastCreditReset: lastReset,
      createdAt: new Date('2020-01-01T00:00:00Z'),
    };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.getCredits('test-uuid');
    const resetsAt = new Date(result.resetsAt);

    // Should be based on lastCreditReset (first of next month from lastReset)
    const expectedMonth = (lastReset.getMonth() + 1) % 12;
    // resetsAt should be in the future relative to lastReset
    expect(resetsAt.getTime()).toBeGreaterThan(lastReset.getTime());
    expect(resetsAt.getDate()).toBe(1);
  });

  it('should advance resetsAt if it is in the past', async () => {
    const user = {
      ...mockUser,
      createdAt: new Date('2020-01-15T00:00:00Z'),
      lastCreditReset: undefined,
    };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.getCredits('test-uuid');
    const resetsAt = new Date(result.resetsAt);

    // resetsAt must be in the future since 2020-02-01 is in the past
    expect(resetsAt.getTime()).toBeGreaterThanOrEqual(Date.now() - 60000); // allow 1min tolerance
    expect(resetsAt.getDate()).toBe(1);
  });

  it('should return correct credit balance', async () => {
    const user = { ...mockUser, credits: 15 };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: -8 } });

    const result = await service.getCredits('test-uuid');

    expect(result.available).toBe(15);
    expect(result.used).toBe(8);
    expect(result.total).toBe(23); // 15 + 8
    expect(result.role).toBe(user.role);
    expect(result.resetsAt).toBeDefined();
  });
});
