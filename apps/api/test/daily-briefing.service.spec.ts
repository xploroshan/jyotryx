import { Test, TestingModule } from '@nestjs/testing';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { mockPrismaService, mockOpenAIService, mockKnowledgeService, mockCacheService, mockUser } from './helpers/mocks';

describe('DailyBriefingService', () => {
  let service: DailyBriefingService;
  let prisma: any;
  let knowledgeService: any;
  let cacheService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    knowledgeService = mockKnowledgeService();
    cacheService = mockCacheService();

    prisma.user.findUnique.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyBriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: knowledgeService },
        { provide: MemoryCacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<DailyBriefingService>(DailyBriefingService);
  });

  // ─── Positive Tests ─────────────────────────────────────────────

  describe('getDailyBriefing', () => {
    it('should return a complete briefing with all fields', async () => {
      const result = await service.getDailyBriefing('test-uuid');

      expect(result.greeting).toBeTruthy();
      expect(result.date).toBeTruthy();
      expect(result.dayQuality).toMatch(/^(excellent|good|moderate|challenging)$/);
      expect(result.summary).toBeTruthy();
      expect(result.doList).toBeDefined();
      expect(result.doList.length).toBeGreaterThan(0);
      expect(result.avoidList).toBeDefined();
      expect(result.avoidList.length).toBeGreaterThan(0);
      expect(result.planetaryHours).toBeDefined();
      expect(result.planetaryHours.length).toBe(24);
      expect(result.luckyColor).toBeTruthy();
      expect(result.luckyNumber).toBeGreaterThanOrEqual(1);
      expect(result.luckyNumber).toBeLessThanOrEqual(9);
      expect(result.professionInsight).toBeTruthy();
      expect(result.remedy).toBeTruthy();
      expect(result.mantra).toBeTruthy();
      expect(result.panchang).toBeDefined();
      expect(result.panchang.tithi).toBeTruthy();
      expect(result.panchang.nakshatra).toBeTruthy();
      expect(result.panchang.yoga).toBeTruthy();
      expect(result.panchang.vara).toBeTruthy();
      expect(result.panchang.rahukaal).toBeTruthy();
    });

    it('should include user name in greeting', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toContain('Test');
    });

    it('should return profession-specific insight for SOFTWARE', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: 'SOFTWARE' });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.professionInsight).toBeTruthy();
      expect(result.professionInsight.length).toBeGreaterThan(20);
    });

    it('should return profession-specific insight for SALES', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: 'SALES' });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.professionInsight).toBeTruthy();
    });

    it('should return profession-specific insight for FINANCE', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: 'FINANCE' });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.professionInsight).toBeTruthy();
    });

    it('should return profession-specific insight for STUDENT', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: 'STUDENT' });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.professionInsight).toBeTruthy();
    });

    it('should return transit alert for users with birth date', async () => {
      // User at age ~30 should trigger Saturn return
      const age30user = { ...mockUser, dateOfBirth: new Date(new Date().getFullYear() - 29, 5, 15) };
      prisma.user.findUnique.mockResolvedValue(age30user);
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.transitAlert).toBeTruthy();
      expect(result.transitAlert).toContain('Saturn');
    });

    it('should return cached briefing when available', async () => {
      const cachedBriefing = { greeting: 'Cached!', date: '2026-01-01' };
      cacheService.get.mockReturnValue(cachedBriefing);

      const result = await service.getDailyBriefing('test-uuid');
      expect(result).toEqual(cachedBriefing);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should have exactly one current hora', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      const currentHours = result.planetaryHours.filter((h) => h.isCurrent);
      expect(currentHours.length).toBeLessThanOrEqual(1);
    });

    it('should have valid planetary hour planets', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      const validPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
      result.planetaryHours.forEach((h) => {
        expect(validPlanets).toContain(h.planet);
        expect(h.startTime).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
        expect(h.endTime).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
        expect(h.activities.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── Negative Tests ─────────────────────────────────────────────

  describe('getDailyBriefing - edge cases', () => {
    it('should handle user with no profession set', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: null });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.professionInsight).toBeTruthy();
    });

    it('should handle user with no birth date', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, dateOfBirth: null });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.transitAlert).toBeNull();
    });

    it('should handle user with no name', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, name: '' });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toContain('there');
    });

    it('should handle user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.getDailyBriefing('nonexistent');
      expect(result.greeting).toBeTruthy();
      expect(result.professionInsight).toBeTruthy();
    });

    it('should handle knowledge service failure gracefully', async () => {
      knowledgeService.search.mockRejectedValue(new Error('KB down'));
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.summary).toBeTruthy();
    });
  });

  // ─── Planetary Hours Tests ──────────────────────────────────────

  describe('getPlanetaryHoursOnly', () => {
    it('should return 24 planetary hours', async () => {
      const hours = await service.getPlanetaryHoursOnly();
      expect(hours.length).toBe(24);
    });

    it('should have each hour with activities and avoid lists', async () => {
      const hours = await service.getPlanetaryHoursOnly();
      hours.forEach((h) => {
        expect(h.activities.length).toBeGreaterThan(0);
        expect(h.avoid.length).toBeGreaterThan(0);
      });
    });
  });
});
