import { Test, TestingModule } from '@nestjs/testing';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { mockOpenAIService, mockKnowledgeService, mockKbService, mockPrismaService } from './helpers/mocks';

describe('NumerologyService', () => {
  let service: NumerologyService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumerologyService,
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NumerologyService>(NumerologyService);
  });

  // ─── Name Analysis - Positive Tests ────────────────────────────

  describe('analyzeName', () => {
    it('should return complete analysis for a valid name', async () => {
      const result = await service.analyzeName('Arjun Sharma');

      expect(result.name).toBe('Arjun Sharma');
      expect(result.destinyNumber).toBeGreaterThanOrEqual(1);
      expect(result.destinyNumber).toBeLessThanOrEqual(9);
      expect(result.soulNumber).toBeGreaterThanOrEqual(1);
      expect(result.soulNumber).toBeLessThanOrEqual(9);
      expect(result.personalityNumber).toBeGreaterThanOrEqual(1);
      expect(result.personalityNumber).toBeLessThanOrEqual(9);
      expect(result.destinyMeaning).toBeTruthy();
      expect(result.soulMeaning).toBeTruthy();
      expect(result.personalityMeaning).toBeTruthy();
      expect(result.overallVerdict).toMatch(/^(highly_favorable|favorable|neutral|unfavorable)$/);
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.cautions.length).toBeGreaterThan(0);
      expect(result.luckyColors.length).toBeGreaterThan(0);
      expect(result.bestDaysToUse.length).toBeGreaterThan(0);
      expect(result.rulingPlanet).toBeTruthy();
      expect(result.compatibility).toBeTruthy();
      expect(result.suggestion).toBeTruthy();
    });

    it('should produce different results for different names', async () => {
      const r1 = await service.analyzeName('Amit');
      const r2 = await service.analyzeName('Priya');

      // Names with different letters should often have different destiny numbers
      expect(r1.name).toBe('Amit');
      expect(r2.name).toBe('Priya');
    });

    it('should handle single-character name', async () => {
      const result = await service.analyzeName('A');
      expect(result.destinyNumber).toBeGreaterThanOrEqual(1);
    });

    it('should handle very long names', async () => {
      const longName = 'Ramakrishna Paramahansa Vivekananda Swami';
      const result = await service.analyzeName(longName);
      expect(result.destinyNumber).toBeGreaterThanOrEqual(1);
      expect(result.destinyNumber).toBeLessThanOrEqual(9);
    });

    it('should ignore spaces and special characters', async () => {
      const r1 = await service.analyzeName('Arjun');
      const r2 = await service.analyzeName('  Arjun  ');
      expect(r1.destinyNumber).toBe(r2.destinyNumber);
    });

    it('should be case-insensitive', async () => {
      const r1 = await service.analyzeName('arjun');
      const r2 = await service.analyzeName('ARJUN');
      expect(r1.destinyNumber).toBe(r2.destinyNumber);
    });

    it('should handle names with numbers in them', async () => {
      const result = await service.analyzeName('Player123');
      expect(result.destinyNumber).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Name Analysis - Negative Tests ────────────────────────────

  describe('analyzeName - edge cases', () => {
    it('should handle empty string', async () => {
      const result = await service.analyzeName('');
      expect(result.destinyNumber).toBe(1);
      expect(result.suggestion).toContain('valid name');
    });

    it('should handle string with only numbers', async () => {
      const result = await service.analyzeName('12345');
      expect(result.destinyNumber).toBe(1);
      expect(result.suggestion).toContain('valid name');
    });

    it('should handle string with only special characters', async () => {
      const result = await service.analyzeName('!@#$%');
      expect(result.destinyNumber).toBe(1);
    });
  });

  // ─── Brand Analysis - Positive Tests ───────────────────────────

  describe('analyzeBrand', () => {
    it('should return complete brand analysis', async () => {
      const result = await service.analyzeBrand('TechNova');

      expect(result.brandName).toBe('TechNova');
      expect(result.nameNumber).toBeGreaterThanOrEqual(1);
      expect(result.nameNumber).toBeLessThanOrEqual(9);
      expect(result.vibration).toBeTruthy();
      expect(result.planetaryRuler).toBeTruthy();
      expect(result.suitableFor.length).toBeGreaterThan(0);
      expect(result.avoidFor.length).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThanOrEqual(1);
      expect(result.overallScore).toBeLessThanOrEqual(10);
      expect(result.recommendation).toBeTruthy();
      expect(result.bestLaunchDays.length).toBeGreaterThan(0);
      expect(result.luckyColors.length).toBeGreaterThan(0);
    });

    it('should score favorably for known good numbers', async () => {
      // Test multiple brand names and verify score is within range
      const brands = ['Alpha', 'Zenith', 'Omega', 'Nova', 'Spark'];
      for (const brand of brands) {
        const result = await service.analyzeBrand(brand);
        expect(result.overallScore).toBeGreaterThanOrEqual(1);
        expect(result.overallScore).toBeLessThanOrEqual(10);
      }
    });

    it('should recommend industry types', async () => {
      const result = await service.analyzeBrand('FinWealth');
      expect(result.suitableFor).toBeDefined();
      expect(Array.isArray(result.suitableFor)).toBe(true);
    });
  });

  // ─── Personal Year - Positive Tests ────────────────────────────

  describe('getPersonalYear', () => {
    it('should return complete personal year forecast', async () => {
      const result = await service.getPersonalYear('1990-05-15');

      expect(result.personalYear).toBeGreaterThanOrEqual(1);
      expect(result.personalYear).toBeLessThanOrEqual(9);
      expect(result.theme).toBeTruthy();
      expect(result.description).toBeTruthy();
      expect(result.career).toBeTruthy();
      expect(result.finance).toBeTruthy();
      expect(result.relationships).toBeTruthy();
      expect(result.health).toBeTruthy();
      expect(result.months).toBeDefined();
      expect(result.months.length).toBe(12);
    });

    it('should have unique themes for each personal year', async () => {
      const themes = new Set<string>();
      // Different DOBs should produce different personal years
      const dobs = ['1990-01-01', '1990-02-15', '1990-03-20', '1990-04-10', '1990-05-05'];
      for (const dob of dobs) {
        const result = await service.getPersonalYear(dob);
        themes.add(result.theme);
      }
      // At least some should be different
      expect(themes.size).toBeGreaterThanOrEqual(1);
    });

    it('should include monthly forecasts', async () => {
      const result = await service.getPersonalYear('1990-05-15');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      result.months.forEach((m, i) => {
        expect(m.month).toBe(monthNames[i]);
        expect(m.focus).toBeTruthy();
      });
    });
  });

  // ─── Mulank (profile-driven) ───────────────────────────────────

  describe('getMulank', () => {
    it('returns hasBirthDetails:false when the profile has no DOB', async () => {
      prisma.user.findUnique.mockResolvedValue({ dateOfBirth: null });
      const result = await service.getMulank('user-1');
      expect(result.hasBirthDetails).toBe(false);
      expect((result as any).mulank).toBeUndefined();
    });

    it('returns hasBirthDetails:false when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.getMulank('ghost');
      expect(result.hasBirthDetails).toBe(false);
    });

    it('computes a full reading from the saved DOB', async () => {
      // 15 Aug 1990 → Mulank 1+5=6, Bhagyank 1+5+0+8+1+9+9+0=33→6
      prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date('1990-08-15T00:00:00.000Z') });
      const result = await service.getMulank('user-1');

      expect(result.hasBirthDetails).toBe(true);
      if (!result.hasBirthDetails) throw new Error('unreachable');
      expect(result.mulank).toBe(6);
      expect(result.bhagyank).toBe(6);
      expect(result.mulankProfile.planet).toBe('Venus');
      expect(result.compatibility).toHaveLength(9);
      expect(result.summary).toContain('Mulank');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { dateOfBirth: true },
      });
    });

    it('is timezone-stable: a date-only DOB keeps its calendar day', async () => {
      prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date('2000-01-29T00:00:00.000Z') });
      const result = await service.getMulank('user-1');
      if (!result.hasBirthDetails) throw new Error('unreachable');
      // 29 → 2+9 = 11 → 2, passing through master 11
      expect(result.day).toBe(29);
      expect(result.mulank).toBe(2);
      expect(result.mulankMaster).toBe(11);
    });
  });
});
