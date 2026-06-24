import { NotFoundException } from '@nestjs/common';
import { MatchShareService } from '../src/modules/match-share/match-share.service';

describe('MatchShareService', () => {
  let service: MatchShareService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      sharedMatch: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new MatchShareService(prisma);
  });

  describe('create', () => {
    it('persists a snapshot and returns the generated token', async () => {
      prisma.sharedMatch.create.mockResolvedValue({ token: 'tok123' });
      const res = await service.create('u1', {
        partner1Name: '  Asha  ',
        partner2Name: 'Ravi',
        totalScore: 28,
        maxScore: 36,
        compatibility: 'Very Good',
        recommendation: 'A promising match.',
        manglikA: false,
        manglikB: true,
        gunaDetails: [{ guna: 'Varna', maxPoints: 1, obtainedPoints: 1, description: 'caste' }],
        locale: 'en',
      });
      expect(res).toEqual({ token: 'tok123' });
      const data = prisma.sharedMatch.create.mock.calls[0][0].data;
      expect(data.createdById).toBe('u1');
      expect(data.personAName).toBe('Asha'); // trimmed
      expect(data.totalScore).toBe(28);
      expect(data.maxScore).toBe(36);
      expect(typeof data.token).toBe('string');
      expect(data.token.length).toBeGreaterThan(10);
    });

    it('falls back to placeholder names and clamps an out-of-range score', async () => {
      prisma.sharedMatch.create.mockResolvedValue({ token: 't' });
      await service.create('u1', { totalScore: 999, maxScore: 36 });
      const data = prisma.sharedMatch.create.mock.calls[0][0].data;
      expect(data.personAName).toBe('Partner A');
      expect(data.personBName).toBe('Partner B');
      expect(data.totalScore).toBe(36); // clamped to maxScore
      expect(data.compatibility).toBe('Average'); // default
    });

    it('caps the number of guna rows and clamps obtained to max to maxScore', async () => {
      prisma.sharedMatch.create.mockResolvedValue({ token: 't' });
      const many = Array.from({ length: 30 }, (_, i) => ({
        guna: `g${i}`,
        maxPoints: 50, // above maxScore
        obtainedPoints: 99, // above its own max
        description: 'd',
      }));
      await service.create('u1', { totalScore: 10, maxScore: 36, gunaDetails: many });
      const data = prisma.sharedMatch.create.mock.calls[0][0].data;
      expect(data.gunaDetails.length).toBe(MatchShareService.MAX_GUNA);
      for (const g of data.gunaDetails) {
        expect(g.maxPoints).toBeLessThanOrEqual(36);
        expect(g.obtainedPoints).toBeLessThanOrEqual(g.maxPoints);
      }
    });

    it('retries on a unique-token collision (P2002) before succeeding', async () => {
      prisma.sharedMatch.create
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ token: 'fresh' });
      const res = await service.create('u1', { totalScore: 20 });
      expect(res).toEqual({ token: 'fresh' });
      expect(prisma.sharedMatch.create).toHaveBeenCalledTimes(2);
    });

    it('accepts a null creator (anonymous snapshot)', async () => {
      prisma.sharedMatch.create.mockResolvedValue({ token: 't' });
      await service.create(null, { totalScore: 5 });
      expect(prisma.sharedMatch.create.mock.calls[0][0].data.createdById).toBeNull();
    });
  });

  describe('getByToken', () => {
    it('maps the row, derives percentage and bumps the view counter', async () => {
      prisma.sharedMatch.findUnique.mockResolvedValue({
        token: 'tok',
        personAName: 'Asha',
        personBName: 'Ravi',
        totalScore: 27,
        maxScore: 36,
        compatibility: 'Very Good',
        recommendation: 'Promising.',
        manglikA: false,
        manglikB: true,
        gunaDetails: [],
        locale: 'en',
        createdAt: new Date('2026-06-24T00:00:00Z'),
      });
      const res = await service.getByToken('tok');
      expect(res.percentage).toBe(75); // round(27/36*100)
      expect(res.personAName).toBe('Asha');
      expect(prisma.sharedMatch.update).toHaveBeenCalledWith({
        where: { token: 'tok' },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('throws NotFound for an unknown token', async () => {
      prisma.sharedMatch.findUnique.mockResolvedValue(null);
      await expect(service.getByToken('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.sharedMatch.update).not.toHaveBeenCalled();
    });

    it('does not let a view-counter failure break the read', async () => {
      prisma.sharedMatch.findUnique.mockResolvedValue({
        token: 'tok',
        personAName: 'A',
        personBName: 'B',
        totalScore: 18,
        maxScore: 36,
        compatibility: 'Good',
        recommendation: '',
        manglikA: false,
        manglikB: false,
        gunaDetails: [],
        locale: null,
        createdAt: new Date(),
      });
      prisma.sharedMatch.update.mockRejectedValue(new Error('db down'));
      const res = await service.getByToken('tok');
      expect(res.percentage).toBe(50);
    });
  });
});
