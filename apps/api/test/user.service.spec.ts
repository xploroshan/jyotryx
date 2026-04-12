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
    gender: 'Male',
    profession: null,
    profilePhoto: null,
    preferredLanguage: 'en',
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
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ affected: BigInt(1) }]),
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

    it('should persist preferredLanguage when set', async () => {
      prisma.user.update.mockResolvedValue({ ...mockUser, preferredLanguage: 'hi' });

      const result = await service.updateProfile('test-uuid', { preferredLanguage: 'hi' });

      expect(result.preferredLanguage).toBe('hi');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
        data: expect.objectContaining({ preferredLanguage: 'hi' }),
      });
    });

    it('should accept every supported language code', async () => {
      const supported = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as'];
      for (const lang of supported) {
        prisma.user.update.mockResolvedValue({ ...mockUser, preferredLanguage: lang });
        const result = await service.updateProfile('test-uuid', { preferredLanguage: lang });
        expect(result.preferredLanguage).toBe(lang);
      }
    });

    it('should reject unsupported language codes', async () => {
      await expect(
        service.updateProfile('test-uuid', { preferredLanguage: 'xx' }),
      ).rejects.toThrow(/Unsupported language/);
      // Prisma should never be called when validation fails
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should NOT overwrite preferredLanguage when the field is omitted', async () => {
      prisma.user.update.mockResolvedValue({ ...mockUser, name: 'Renamed' });
      await service.updateProfile('test-uuid', { name: 'Renamed' });
      const callArg = prisma.user.update.mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty('preferredLanguage');
    });
  });

  describe('getProfile: preferredLanguage', () => {
    it('should return preferredLanguage from the database', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, preferredLanguage: 'ta' });
      const result = await service.getProfile('test-uuid');
      expect(result.preferredLanguage).toBe('ta');
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
    it('should deduct credits via CTE query', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(1) }]);

      const result = await service.deductCredits('test-uuid', 2, 'Test deduction');
      expect(result).toBe(true);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    });

    it('should return false when insufficient credits', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(0) }]);

      const result = await service.deductCredits('test-uuid', 100, 'Too much');
      expect(result).toBe(false);
    });
  });
});
