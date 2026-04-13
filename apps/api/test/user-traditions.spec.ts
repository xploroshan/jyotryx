/**
 * User Service — Astrology Traditions Tests
 *
 * Tests the astrologyTraditions field handling in user profile
 * CRUD operations, including validation and defaults.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserService } from '../src/modules/user/user.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('UserService — Astrology Traditions', () => {
  let service: UserService;
  let prisma: any;

  const mockDbUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+919876543210',
    credits: 20,
    role: 'USER',
    preferredLanguage: 'en',
    gender: 'Male',
    profession: 'SOFTWARE',
    dateOfBirth: new Date('1990-05-15'),
    timeOfBirth: '14:30',
    placeOfBirth: { name: 'Mumbai' },
    profilePhoto: null,
    astrologyTraditions: ['VEDIC'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...mockDbUser }),
        update: jest.fn().mockResolvedValue({ ...mockDbUser }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  // ─── getProfile ───────────────────────────────────────────────────────────

  describe('getProfile — astrologyTraditions field', () => {
    it('should return astrologyTraditions from the database', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['VEDIC', 'WESTERN'],
      });

      const profile = await service.getProfile('test-uuid');

      expect(profile.astrologyTraditions).toEqual(['VEDIC', 'WESTERN']);
    });

    it('should default to [VEDIC] when astrologyTraditions is null/undefined', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: undefined,
      });

      const profile = await service.getProfile('test-uuid');

      expect(profile.astrologyTraditions).toEqual(['VEDIC']);
    });

    it('should return all three traditions when user has them', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
      });

      const profile = await service.getProfile('test-uuid');

      expect(profile.astrologyTraditions).toHaveLength(3);
      expect(profile.astrologyTraditions).toContain('CHINESE');
    });
  });

  // ─── updateProfile — astrologyTraditions ──────────────────────────────────

  describe('updateProfile — astrologyTraditions', () => {
    it('should update astrologyTraditions with valid values', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['VEDIC', 'CHINESE'],
      });

      const profile = await service.updateProfile('test-uuid', {
        astrologyTraditions: ['VEDIC', 'CHINESE'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['VEDIC', 'CHINESE'],
          }),
        }),
      );
    });

    it('should filter out invalid tradition values', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['VEDIC'],
      });

      await service.updateProfile('test-uuid', {
        astrologyTraditions: ['VEDIC', 'MAYAN', 'INVALID'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['VEDIC'],
          }),
        }),
      );
    });

    it('should throw when all provided traditions are invalid', async () => {
      await expect(
        service.updateProfile('test-uuid', {
          astrologyTraditions: ['MAYAN', 'INVALID'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when empty array is provided', async () => {
      await expect(
        service.updateProfile('test-uuid', {
          astrologyTraditions: [],
        }),
      ).rejects.toThrow();
    });

    it('should accept single tradition', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['WESTERN'],
      });

      const profile = await service.updateProfile('test-uuid', {
        astrologyTraditions: ['WESTERN'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['WESTERN'],
          }),
        }),
      );
    });

    it('should not update traditions when astrologyTraditions is not provided', async () => {
      prisma.user.update.mockResolvedValue({ ...mockDbUser });

      await service.updateProfile('test-uuid', { name: 'New Name' });

      // astrologyTraditions should NOT be in the update data
      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.astrologyTraditions).toBeUndefined();
    });

    it('should accept all three original traditions', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
      });

      await service.updateProfile('test-uuid', {
        astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'],
          }),
        }),
      );
    });

    it('should accept all six valid traditions', async () => {
      const allSix = ['VEDIC', 'WESTERN', 'CHINESE', 'HELLENISTIC', 'HORARY', 'MEDICAL'];
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: allSix,
      });

      await service.updateProfile('test-uuid', {
        astrologyTraditions: allSix,
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: allSix,
          }),
        }),
      );
    });

    it('should accept HELLENISTIC tradition', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['HELLENISTIC'],
      });

      await service.updateProfile('test-uuid', {
        astrologyTraditions: ['HELLENISTIC'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['HELLENISTIC'],
          }),
        }),
      );
    });

    it('should accept HORARY tradition', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['HORARY'],
      });

      await service.updateProfile('test-uuid', {
        astrologyTraditions: ['HORARY'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['HORARY'],
          }),
        }),
      );
    });

    it('should accept MEDICAL tradition', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['MEDICAL'],
      });

      await service.updateProfile('test-uuid', {
        astrologyTraditions: ['MEDICAL'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['MEDICAL'],
          }),
        }),
      );
    });

    it('should filter out invalid traditions but keep new valid ones', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        astrologyTraditions: ['HELLENISTIC', 'MEDICAL'],
      });

      await service.updateProfile('test-uuid', {
        astrologyTraditions: ['HELLENISTIC', 'MAYAN', 'MEDICAL'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            astrologyTraditions: ['HELLENISTIC', 'MEDICAL'],
          }),
        }),
      );
    });
  });
});
