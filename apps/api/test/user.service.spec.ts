import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserService } from '../src/modules/user/user.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('UserService', () => {
  let service: UserService;
  let prisma: any;

  const mockUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+919876543210',
    dateOfBirth: new Date('1990-05-15'),
    timeOfBirth: '14:30',
    placeOfBirth: { name: 'Mumbai' },
    profilePhoto: null,
    credits: 10,
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      creditTransaction: {
        aggregate: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('test-uuid');

      expect(result.id).toBe('test-uuid');
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@example.com');
      expect(result.credits).toBe(10);
    });

    it('should throw NotFoundException for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return user profile', async () => {
      prisma.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const result = await service.updateProfile('test-uuid', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });
  });

  describe('getCredits', () => {
    it('should return credit balance', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: -5 } });

      const result = await service.getCredits('test-uuid');

      expect(result.available).toBe(10);
      expect(result.used).toBe(5);
      expect(result.total).toBe(15);
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits via transaction', async () => {
      prisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          user: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          creditTransaction: { create: jest.fn() },
        });
      });

      const result = await service.deductCredits('test-uuid', 2, 'Test deduction');
      expect(result).toBe(true);
    });
  });
});
