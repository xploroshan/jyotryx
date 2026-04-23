import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { AstrologyController } from '../src/modules/astrology/astrology.controller';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { NumerologyController } from '../src/modules/numerology/numerology.controller';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { PalmistryController } from '../src/modules/palmistry/palmistry.controller';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { DailyBriefingController } from '../src/modules/daily-briefing/daily-briefing.controller';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { ChatController } from '../src/modules/chat/chat.controller';
import { ChatService } from '../src/modules/chat/chat.service';
import { LlmService } from '../src/llm/llm.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { StorageService } from '../src/storage/storage.service';
import {
  mockKnowledgeService,
  mockKbService,
  mockOpenAIService,
  mockPrismaService,
  mockCacheService,
  mockUserService,
  mockConfigService,
  mockUser,
  mockBirthDetails,
  mockLlmService,
  mockEphemerisService,
  mockStorageService,
} from './helpers/mocks';

// ─── Mock Auth Guard ─────────────────────────────────────────────────────────
// Bypasses JWT auth and injects a mock user into the request
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { sub: 'test-uuid', email: 'test@example.com', name: 'Test User' };
    return true;
  }
}

// ─── Restrictive Auth Guard ──────────────────────────────────────────────────
// Blocks all requests (simulates no auth token)
class BlockingAuthGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// E2E: ASTROLOGY ENDPOINTS (Horoscope, Panchang, Kundli, Matching, Muhurat)
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E: Astrology Endpoints', () => {
  let service: AstrologyService;
  let userService: any;
  let prisma: any;
  let cacheService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();
    cacheService = mockCacheService();
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AstrologyController],
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: cacheService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: EphemerisService, useValue: mockEphemerisService() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    service = module.get<AstrologyService>(AstrologyService);
  });

  // ─── Horoscope ───────────────────────────────────────────────────────────
  describe('GET /astrology/horoscope/:sign', () => {
    it('should return a complete horoscope for Aries', async () => {
      const result = await service.getHoroscope('aries', 'daily');
      expect(result).toBeDefined();
      expect(result.sign).toBe('Aries');
      expect(result.period).toBe('daily');
      expect(result.prediction).toBeTruthy();
      expect(result.career).toBeTruthy();
      expect(result.health).toBeTruthy();
      expect(result.love).toBeTruthy();
      expect(result.luckyNumber).toBeDefined();
      expect(result.luckyColor).toBeTruthy();
      expect(result.mood).toBeTruthy();
      expect(result.compatibility).toBeTruthy();
    });

    it('should handle all zodiac signs without error', async () => {
      const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
      for (const sign of signs) {
        cacheService.get.mockReturnValue(null);
        const result = await service.getHoroscope(sign);
        expect(result).toBeDefined();
        expect(result.sign).toBeTruthy();
      }
    });

    it('should handle all periods', async () => {
      for (const period of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
        cacheService.get.mockReturnValue(null);
        const result = await service.getHoroscope('leo', period);
        expect(result.period).toBe(period);
      }
    });
  });

  // ─── Panchang ────────────────────────────────────────────────────────────
  describe('GET /astrology/panchang', () => {
    it('should return complete panchang with all fields', async () => {
      const result = await service.getPanchang();
      expect(result.date).toBeTruthy();
      expect(result.tithi).toBeTruthy();
      expect(result.nakshatra).toBeTruthy();
      expect(result.yoga).toBeTruthy();
      expect(result.karana).toBeTruthy();
      expect(result.vara).toBeTruthy();
      expect(result.sunrise).toBeTruthy();
      expect(result.sunset).toBeTruthy();
      expect(result.moonrise).toBeTruthy();
      expect(result.rahukaal).toBeTruthy();
      expect(result.gulikakaal).toBeTruthy();
      expect(result.yamakantaka).toBeTruthy();
    });
  });

  // ─── Kundli ──────────────────────────────────────────────────────────────
  describe('POST /astrology/kundli', () => {
    it('should return kundli with birth details echoed back', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(result.userId).toBe('test-uuid');
      expect(result.birthDetails).toEqual(mockBirthDetails);
      expect(result.ascendant).toBeTruthy();
      expect(result.moonSign).toBeTruthy();
      expect(result.sunSign).toBeTruthy();
      expect(result.nakshatra).toBeTruthy();
      expect(result.houses).toHaveLength(12);
      expect(result.planetaryPositions).toHaveLength(9);
      expect(result.dashas).toBeDefined();
      expect(result.yogas).toBeDefined();
      expect(result.createdAt).toBeTruthy();
    });

    it('should reject when credits are insufficient', async () => {
      userService.deductCredits.mockResolvedValue(false);
      await expect(service.generateKundli('test-uuid', mockBirthDetails)).rejects.toThrow();
    });
  });

  // ─── Matching ────────────────────────────────────────────────────────────
  describe('POST /astrology/matching', () => {
    const partner2 = { dateOfBirth: '1992-08-20', timeOfBirth: '10:00', placeOfBirth: 'Delhi', latitude: 28.6139, longitude: 77.209 };

    it('should return matching result with guna details', async () => {
      const result = await service.getMatching('test-uuid', mockBirthDetails, partner2);
      expect(result.totalScore).toBeDefined();
      expect(result.maxScore).toBe(36);
      expect(result.gunaDetails).toHaveLength(8);
      expect(result.compatibility).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });

    it('should reject when credits insufficient', async () => {
      userService.deductCredits.mockResolvedValue(false);
      await expect(service.getMatching('test-uuid', mockBirthDetails, partner2)).rejects.toThrow();
    });
  });

  // ─── Muhurat ─────────────────────────────────────────────────────────────
  describe('POST /astrology/muhurat', () => {
    it('should return auspicious times for given purpose and date range', async () => {
      const result = await service.getMuhurat({
        purpose: 'Wedding',
        fromDate: '2026-06-01',
        toDate: '2026-06-05',
        location: 'Mumbai',
      });
      expect(result.purpose).toBe('Wedding');
      expect(result.auspiciousTimes).toBeDefined();
      expect(result.auspiciousTimes.length).toBeGreaterThan(0);
      result.auspiciousTimes.forEach((t) => {
        expect(t.date).toBeTruthy();
        expect(t.startTime).toBeTruthy();
        expect(t.endTime).toBeTruthy();
        expect(['excellent', 'good', 'average']).toContain(t.quality);
        expect(t.reason).toBeTruthy();
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E: NUMEROLOGY ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E: Numerology Endpoints', () => {
  let service: NumerologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NumerologyController],
      providers: [
        NumerologyService,
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    service = module.get<NumerologyService>(NumerologyService);
  });

  describe('POST /numerology/name', () => {
    it('should return complete name analysis', async () => {
      const result = await service.analyzeName('Vikram');
      expect(result.name).toBe('Vikram');
      expect(result.destinyNumber).toBeGreaterThanOrEqual(1);
      expect(result.destinyNumber).toBeLessThanOrEqual(9);
      expect(result.soulNumber).toBeGreaterThanOrEqual(1);
      expect(result.personalityNumber).toBeGreaterThanOrEqual(1);
      expect(result.destinyMeaning).toBeTruthy();
      expect(result.overallVerdict).toMatch(/^(highly_favorable|favorable|neutral|unfavorable)$/);
      expect(result.rulingPlanet).toBeTruthy();
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.luckyColors.length).toBeGreaterThan(0);
      expect(result.bestDaysToUse.length).toBeGreaterThan(0);
    });

    it('should handle empty name gracefully', async () => {
      const result = await service.analyzeName('');
      expect(result.destinyNumber).toBe(1);
      expect(result.suggestion).toContain('valid name');
    });
  });

  describe('POST /numerology/brand', () => {
    it('should return complete brand analysis', async () => {
      const result = await service.analyzeBrand('Infosys', 'Technology');
      expect(result.brandName).toBe('Infosys');
      expect(result.nameNumber).toBeGreaterThanOrEqual(1);
      expect(result.nameNumber).toBeLessThanOrEqual(9);
      expect(result.overallScore).toBeGreaterThanOrEqual(1);
      expect(result.overallScore).toBeLessThanOrEqual(10);
      expect(result.planetaryRuler).toBeTruthy();
      expect(result.suitableFor.length).toBeGreaterThan(0);
      expect(result.avoidFor.length).toBeGreaterThan(0);
      expect(result.recommendation).toBeTruthy();
    });
  });

  describe('GET /numerology/personal-year', () => {
    it('should return personal year forecast', async () => {
      const result = await service.getPersonalYear('1990-05-15');
      expect(result.personalYear).toBeGreaterThanOrEqual(1);
      expect(result.personalYear).toBeLessThanOrEqual(9);
      expect(result.theme).toBeTruthy();
      expect(result.description).toBeTruthy();
      expect(result.months).toHaveLength(12);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// E2E: PALMISTRY ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E: Palmistry Endpoint', () => {
  let service: PalmistryService;
  let userService: any;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PalmistryController],
      providers: [
        PalmistryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: StorageService, useValue: mockStorageService() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    service = module.get<PalmistryService>(PalmistryService);
  });

  describe('POST /palmistry/analyze', () => {
    it('should return complete palmistry analysis', async () => {
      const result = await service.analyzePalm('test-uuid', Buffer.from('fake-image'), 'image/jpeg');
      expect(result.id).toBeTruthy();
      expect(result.userId).toBe('test-uuid');
      expect(result.lines).toBeDefined();
      expect(result.mounts).toBeDefined();
      expect(result.fingerAnalysis).toBeDefined();
      expect(result.overallReading).toBeTruthy();
      expect(result.healthInsights).toBeTruthy();
      expect(result.careerInsights).toBeTruthy();
      expect(result.relationshipInsights).toBeTruthy();
      expect(result.createdAt).toBeTruthy();
    });

    it('should work without image (no file uploaded)', async () => {
      const result = await service.analyzePalm('test-uuid');
      expect(result).toBeDefined();
      expect(result.lines.length).toBeGreaterThan(0);
    });

    it('should reject when credits are insufficient', async () => {
      userService.deductCredits.mockResolvedValue(false);
      await expect(service.analyzePalm('test-uuid')).rejects.toThrow();
    });

    it('BUG CONFIRMATION: different images produce identical fallback results', async () => {
      const r1 = await service.analyzePalm('user-A', Buffer.from('image-data-one'), 'image/jpeg');
      const r2 = await service.analyzePalm('user-B', Buffer.from('image-data-two-very-different'), 'image/png');
      // This test documents the bug: results are identical regardless of input
      expect(r1.overallReading).toBe(r2.overallReading);
      expect(r1.lines.map((l) => l.name)).toEqual(r2.lines.map((l) => l.name));
      expect(r1.mounts.map((m) => m.name)).toEqual(r2.mounts.map((m) => m.name));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E: DAILY BRIEFING (My Day) ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E: Daily Briefing Endpoints', () => {
  let service: DailyBriefingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyBriefingController],
      providers: [
        DailyBriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    service = module.get<DailyBriefingService>(DailyBriefingService);
  });

  describe('GET /daily-briefing', () => {
    it('should return complete daily briefing', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toBeTruthy();
      expect(result.date).toBeTruthy();
      expect(result.dayQuality).toMatch(/^(excellent|good|moderate|challenging)$/);
      expect(result.summary).toBeTruthy();
      expect(result.doList.length).toBeGreaterThan(0);
      expect(result.avoidList.length).toBeGreaterThan(0);
      expect(result.planetaryHours).toHaveLength(24);
      expect(result.luckyColor).toBeTruthy();
      expect(result.luckyNumber).toBeGreaterThanOrEqual(1);
      expect(result.luckyNumber).toBeLessThanOrEqual(9);
      expect(result.professionInsight).toBeTruthy();
      expect(result.remedy).toBeTruthy();
      expect(result.mantra).toBeTruthy();
      expect(result.panchang).toBeDefined();
    });
  });

  describe('GET /daily-briefing/planetary-hours', () => {
    it('should return 24 planetary hours', async () => {
      const result = await service.getPlanetaryHoursOnly();
      expect(result).toHaveLength(24);
      result.forEach((h) => {
        expect(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']).toContain(h.planet);
        expect(h.startTime).toBeTruthy();
        expect(h.endTime).toBeTruthy();
        expect(h.activities.length).toBeGreaterThan(0);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E: CHAT (Consult) ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E: Chat (Consult) Endpoints', () => {
  let service: ChatService;
  let prisma: any;
  let userService: any;

  const mockSession = {
    id: 'session-1',
    userId: 'test-uuid',
    title: 'My query',
    category: 'general',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  };

  const mockReplyMsg = {
    id: 'msg-reply',
    sessionId: 'session-1',
    role: 'ASSISTANT',
    content: 'The stars indicate positive energy for your endeavors.',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();

    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.chatSession.create.mockResolvedValue(mockSession);
    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatMessage.create.mockResolvedValue(mockReplyMsg);
    prisma.chatMessage.findMany.mockResolvedValue([]);

    const openai = {
      chatCompletion: jest.fn().mockResolvedValue('The stars indicate positive energy for your endeavors.'),
      getClient: jest.fn().mockReturnValue({}),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: openai },
        { provide: LlmService, useValue: mockLlmService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('POST /chat/message', () => {
    it('should return session and reply', async () => {
      const result = await service.sendMessage('test-uuid', {
        message: 'What does my horoscope say?',
        category: 'general',
      });
      expect(result.session).toBeDefined();
      expect(result.session.id).toBeTruthy();
      expect(result.session.category).toBe('general');
      expect(result.reply).toBeDefined();
      expect(result.reply.content).toBeTruthy();
      expect(result.reply.role).toBe('assistant');
    });

    it('should deduct credits', async () => {
      await service.sendMessage('test-uuid', { message: 'Hello', category: 'general' });
      expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 1, expect.any(String));
    });

    it('should reject when insufficient credits', async () => {
      userService.deductCredits.mockResolvedValue(false);
      await expect(
        service.sendMessage('test-uuid', { message: 'Hello', category: 'general' }),
      ).rejects.toThrow();
    });
  });

  describe('GET /chat/sessions', () => {
    it('should return list of sessions', async () => {
      prisma.chatSession.findMany.mockResolvedValue([mockSession]);
      const result = await service.getSessions('test-uuid');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no sessions', async () => {
      prisma.chatSession.findMany.mockResolvedValue([]);
      const result = await service.getSessions('test-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('GET /chat/sessions/:id', () => {
    it('should return session with messages', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: 'msg-1', role: 'USER', content: 'Hello', createdAt: new Date(), sessionId: 'session-1' },
        { id: 'msg-2', role: 'ASSISTANT', content: 'Namaste!', createdAt: new Date(), sessionId: 'session-1' },
      ]);
      const result = await service.getSession('test-uuid', 'session-1');
      expect(result.id).toBe('session-1');
      expect(result.messages.length).toBe(2);
    });

    it('should throw for non-existent session', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      await expect(service.getSession('test-uuid', 'nonexistent')).rejects.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E: Cross-Feature Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E: Cross-Feature Consistency', () => {
  let astrologyService: AstrologyService;
  let dailyBriefingService: DailyBriefingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        DailyBriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
        { provide: EphemerisService, useValue: mockEphemerisService() },
      ],
    }).compile();

    astrologyService = module.get<AstrologyService>(AstrologyService);
    dailyBriefingService = module.get<DailyBriefingService>(DailyBriefingService);
  });

  it('Panchang nakshatra from astrology service should be valid', async () => {
    const panchang = await astrologyService.getPanchang();
    const validNakshatras = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
    expect(validNakshatras).toContain(panchang.nakshatra);
  });

  it('Daily briefing panchang should contain valid nakshatra', async () => {
    const briefing = await dailyBriefingService.getDailyBriefing('test-uuid');
    const validNakshatras = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
    expect(validNakshatras).toContain(briefing.panchang.nakshatra);
  });

  it('Kundli for mockUser birth details should produce valid chart', async () => {
    const kundli = await astrologyService.generateKundli('test-uuid', mockBirthDetails);
    expect(kundli.houses).toHaveLength(12);
    expect(kundli.planetaryPositions).toHaveLength(9);

    // Cross-check: moon sign from kundli should be a valid sign
    const validSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    expect(validSigns).toContain(kundli.moonSign);

    // Cross-check: horoscope for the user's moon sign should work
    const horoscope = await astrologyService.getHoroscope(kundli.moonSign.toLowerCase(), 'daily');
    expect(horoscope.sign).toBe(kundli.moonSign);
  });
});
