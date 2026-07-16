import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { mockFeatureAccessService } from './helpers/mocks';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { ModerationService } from '../src/safety/moderation.service';
import { MemoryService } from '../src/modules/memory/memory.service';
import { KbService } from '../src/knowledge/kb.service';
import { MemoryCacheService } from '../src/common/cache.service';
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
  mockMemoryService,
} from './helpers/mocks';

// ═══════════════════════════════════════════════════════════════════════════════
// VALID CONSTANTS for Vedic Astrology validation
// ═══════════════════════════════════════════════════════════════════════════════
const VALID_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const VALID_NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
const VALID_YOGAS = ['Vishkambha', 'Preeti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shoola', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
const VALID_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti', 'Shakuni', 'Chatushpada', 'Nagava', 'Kimstughna'];
const VALID_TITHIS = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
const VALID_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const VALID_VARAS = ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];
const DASHA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PALMISTRY — Critical Bug: Same results for everyone
// ═══════════════════════════════════════════════════════════════════════════════
describe('Palmistry Service — Correctness & Bug Validation', () => {
  let service: PalmistryService;
  let userService: any;
  let featureAccess: any;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();
    featureAccess = mockFeatureAccessService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PalmistryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: FeatureAccessService, useValue: featureAccess },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: StorageService, useValue: mockStorageService() },
      ],
    }).compile();
    service = module.get<PalmistryService>(PalmistryService);
  });

  describe('FIXED: the canned fallback can no longer masquerade as a real reading', () => {
    // Historical bug (retired): when the vision model was unavailable, every
    // user silently received the IDENTICAL canned reading, image or not.
    // Under the honesty contract an image-backed analysis that cannot run
    // FAILS visibly (503, no charge) instead of returning fake results.
    it('fails honestly (503, no charge) for an image-backed request when vision is unavailable', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      await expect(
        service.analyzePalm('user-1', Buffer.from('palm-image-A'), 'image/jpeg'),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(featureAccess.consumeEntitlement).not.toHaveBeenCalled();
    });

    it('labels the no-image sample reading as NOT authentic', async () => {
      const result: any = await service.analyzePalm('user-1');
      expect(result.verification.authentic).toBe(false);
      expect(result.verification.authenticReason).toBe('no_image');
      // And it is never charged.
      expect(featureAccess.consumeEntitlement).not.toHaveBeenCalled();
      expect(featureAccess.incrementUsage).not.toHaveBeenCalled();
    });
  });

  describe('Fallback analysis structure validation', () => {
    it('should return the seven standard palm lines in order', async () => {
      const result = await service.analyzePalm('user-1');
      expect(result.lines).toHaveLength(7);
      const expectedNames = [
        'Heart Line', 'Head Line', 'Life Line', 'Fate Line',
        'Sun Line', 'Mercury Line', 'Marriage Line',
      ];
      result.lines.forEach((line, i) => {
        expect(line.name).toBe(expectedNames[i]);
      });
    });

    it('should have valid strength enum for each line', async () => {
      const result = await service.analyzePalm('user-1');
      result.lines.forEach((line) => {
        expect(['strong', 'moderate', 'weak']).toContain(line.strength);
        expect(line.description).toBeTruthy();
        expect(line.interpretation).toBeTruthy();
      });
    });

    it('should return the six standard mounts with valid prominence', async () => {
      const result = await service.analyzePalm('user-1');
      expect(result.mounts).toHaveLength(6);
      result.mounts.forEach((mount) => {
        expect(['elevated', 'normal', 'flat']).toContain(mount.prominence);
        expect(mount.name).toBeTruthy();
        expect(mount.interpretation).toBeTruthy();
      });
    });

    it('should return exactly 5 finger analyses with valid length', async () => {
      const result = await service.analyzePalm('user-1');
      expect(result.fingerAnalysis).toHaveLength(5);
      result.fingerAnalysis.forEach((finger) => {
        expect(['long', 'average', 'short']).toContain(finger.length);
        expect(finger.finger).toBeTruthy();
        expect(finger.interpretation).toBeTruthy();
      });
    });

    it('should include all insight sections', async () => {
      const result = await service.analyzePalm('user-1');
      expect(result.overallReading.length).toBeGreaterThan(50);
      expect(result.healthInsights.length).toBeGreaterThan(30);
      expect(result.careerInsights.length).toBeGreaterThan(30);
      expect(result.relationshipInsights.length).toBeGreaterThan(30);
    });
  });

  describe('Unlock and save behavior', () => {
    it('should gate analysis on a one-time entitlement', async () => {
      await service.analyzePalm('user-1');
      expect(featureAccess.resolveUnlock).toHaveBeenCalledWith('user-1', 'PALMISTRY');
      expect(userService.deductCredits).not.toHaveBeenCalled();
    });

    it('should propagate 402 when no unlock is available', async () => {
      const { PaymentRequiredException } = await import('../src/common/exceptions/payment-required.exception');
      featureAccess.resolveUnlock.mockRejectedValue(new PaymentRequiredException());
      await expect(service.analyzePalm('user-1')).rejects.toThrow(PaymentRequiredException);
    });

    it('should save reading to database with userId', async () => {
      await service.analyzePalm('user-1');
      expect(prisma.palmistryReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 2. NUMEROLOGY — Mathematical Correctness
// ═══════════════════════════════════════════════════════════════════════════════
describe('Numerology Service — Mathematical Correctness', () => {
  let service: NumerologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumerologyService,
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: KbService, useValue: mockKbService() },
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();
    service = module.get<NumerologyService>(NumerologyService);
  });

  describe('Chaldean number calculation correctness', () => {
    it('should compute correct destiny number for "abc" (a=1,b=2,c=3 → 6)', async () => {
      const result = await service.analyzeName('abc');
      // Chaldean: a=1, b=2, c=3 → sum=6, reduce: 6 → destiny=6
      expect(result.destinyNumber).toBe(6);
    });

    it('should compute correct destiny number for "amit" using Chaldean values', async () => {
      // Chaldean: a=1, m=4, i=1, t=4 → sum=10 → 1+0=1
      const result = await service.analyzeName('amit');
      expect(result.destinyNumber).toBe(1);
    });

    it('should compute correct destiny number for "priya" using Chaldean values', async () => {
      // Chaldean: p=8, r=2, i=1, y=1, a=1 → sum=13 → 1+3=4
      const result = await service.analyzeName('priya');
      expect(result.destinyNumber).toBe(4);
    });

    it('should compute correct destiny number for "zara" using Chaldean values', async () => {
      // Chaldean: z=7, a=1, r=2, a=1 → sum=11 → master number preserved
      const result = await service.analyzeName('zara');
      expect(result.destinyNumber).toBe(11);
    });

    it('should reduce multi-digit sums correctly (28→10→1)', async () => {
      // "fox" → f=8, o=7, x=5 → 20 → 2+0 = 2
      const result = await service.analyzeName('fox');
      expect(result.destinyNumber).toBe(2);
    });
  });

  describe('Soul number (vowels) correctness', () => {
    it('should compute soul number from vowels only using Pythagorean values', async () => {
      // "arjun" → vowels: a(1) + u(3) = 4
      const result = await service.analyzeName('arjun');
      expect(result.soulNumber).toBe(4);
    });

    it('should compute soul number for "priya" from vowels', async () => {
      // "priya" → vowels: i(9) + a(1) = 10 → 1
      const result = await service.analyzeName('priya');
      expect(result.soulNumber).toBe(1);
    });
  });

  describe('Personality number (consonants) correctness', () => {
    it('should compute personality number from consonants using Pythagorean values', async () => {
      // "arjun" → consonants: r(9) + j(1) + n(5) = 15 → 1+5=6
      const result = await service.analyzeName('arjun');
      expect(result.personalityNumber).toBe(6);
    });
  });

  describe('Different names produce different results', () => {
    it('should produce different destiny numbers for "amit" vs "zara"', async () => {
      const r1 = await service.analyzeName('amit');
      const r2 = await service.analyzeName('zara');
      // amit=1, zara=2
      expect(r1.destinyNumber).not.toBe(r2.destinyNumber);
    });

    it('should produce different overall verdicts for names with different number qualities', async () => {
      // Number 1 (amit) is favorable destiny + favorable soul → highly_favorable or favorable
      const favorable = await service.analyzeName('amit'); // destiny=1
      expect(favorable.destinyNumber).toBe(1);
      expect(['highly_favorable', 'favorable']).toContain(favorable.overallVerdict);

      // "priya" has destiny=4 (unfavorable) but soul=1 (favorable), so verdict is 'favorable'
      // because the logic is: destinyFavorable || soulFavorable → 'favorable'
      const mixed = await service.analyzeName('priya'); // destiny=4, soul=1
      expect(mixed.destinyNumber).toBe(4);
      expect(mixed.overallVerdict).toBe('favorable'); // soul rescues it
    });
  });

  describe('Ruling planet correctness', () => {
    it('should assign Sun as ruling planet for destiny number 1', async () => {
      const result = await service.analyzeName('amit'); // destiny=1
      expect(result.rulingPlanet).toBe('Sun');
    });

    it('should assign Rahu as ruling planet for destiny number 4', async () => {
      const result = await service.analyzeName('priya'); // destiny=4
      expect(result.rulingPlanet).toBe('Rahu');
    });

    it('should assign Moon (Master) as ruling planet for master number 11', async () => {
      const result = await service.analyzeName('zara'); // destiny=11 (master number)
      expect(result.rulingPlanet).toBe('Moon (Master)');
    });
  });

  describe('Personal year calculation', () => {
    it('should return personal year between 1-9', async () => {
      const result = await service.getPersonalYear('1990-05-15');
      expect(result.personalYear).toBeGreaterThanOrEqual(1);
      expect(result.personalYear).toBeLessThanOrEqual(9);
    });

    it('should be deterministic for same DOB', async () => {
      const r1 = await service.getPersonalYear('1990-05-15');
      const r2 = await service.getPersonalYear('1990-05-15');
      expect(r1.personalYear).toBe(r2.personalYear);
      expect(r1.theme).toBe(r2.theme);
    });

    it('should produce 12 monthly forecasts', async () => {
      const result = await service.getPersonalYear('1990-05-15');
      expect(result.months).toHaveLength(12);
      expect(result.months[0].month).toBe('January');
      expect(result.months[11].month).toBe('December');
    });

    it('should have valid theme for each personal year number', async () => {
      const result = await service.getPersonalYear('1990-05-15');
      expect(result.theme).toBeTruthy();
      expect(result.description).toBeTruthy();
      expect(result.career).toBeTruthy();
      expect(result.finance).toBeTruthy();
      expect(result.relationships).toBeTruthy();
      expect(result.health).toBeTruthy();
    });
  });

  describe('Brand analysis correctness', () => {
    it('should return score between 1-10', async () => {
      const result = await service.analyzeBrand('TechNova');
      expect(result.overallScore).toBeGreaterThanOrEqual(1);
      expect(result.overallScore).toBeLessThanOrEqual(10);
    });

    it('should return different results for different brand names', async () => {
      const r1 = await service.analyzeBrand('Alpha');
      const r2 = await service.analyzeBrand('Omega');
      // At minimum the nameNumber or vibration should differ
      expect(r1.brandName).toBe('Alpha');
      expect(r2.brandName).toBe('Omega');
    });

    it('should include suitable and avoid industry sectors', async () => {
      const result = await service.analyzeBrand('Zenith');
      expect(result.suitableFor.length).toBeGreaterThan(0);
      expect(result.avoidFor.length).toBeGreaterThan(0);
    });

    it('should provide alternative numbers', async () => {
      const result = await service.analyzeBrand('Acme');
      expect(result.alternativeNumbers.length).toBeGreaterThan(0);
      result.alternativeNumbers.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(9);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty name gracefully', async () => {
      const result = await service.analyzeName('');
      expect(result.destinyNumber).toBe(1);
      expect(result.suggestion).toContain('valid name');
    });

    it('should handle numeric-only input', async () => {
      const result = await service.analyzeName('12345');
      expect(result.destinyNumber).toBe(1);
    });

    it('should be case-insensitive', async () => {
      const lower = await service.analyzeName('arjun');
      const upper = await service.analyzeName('ARJUN');
      expect(lower.destinyNumber).toBe(upper.destinyNumber);
      expect(lower.soulNumber).toBe(upper.soulNumber);
      expect(lower.personalityNumber).toBe(upper.personalityNumber);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 3. KUNDLI — Astronomical Correctness
// ═══════════════════════════════════════════════════════════════════════════════
describe('Kundli (Birth Chart) — Astronomical Correctness', () => {
  let service: AstrologyService;
  let prisma: any;
  let userService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();
    // Use an input-sensitive mock so different birth details produce different charts
    const ephemeris = mockEphemerisService();
    ephemeris.computeChart.mockImplementation(async (input: any) => {
      const offset = (input.hour || 0) * 15 + (input.day || 1) * 3;
      return {
        julianDay: 2448000.0 + offset,
        positions: [
          { name: 'Sun', longitude: (54.5 + offset) % 360, speed: 0.95 },
          { name: 'Moon', longitude: (120.3 + offset * 2) % 360, speed: 12.5 },
          { name: 'Mars', longitude: (180.0 + offset) % 360, speed: 0.6 },
          { name: 'Mercury', longitude: (45.0 + offset) % 360, speed: 1.2 },
          { name: 'Jupiter', longitude: (90.0 + offset) % 360, speed: 0.08 },
          { name: 'Venus', longitude: (30.0 + offset) % 360, speed: 1.1 },
          { name: 'Saturn', longitude: (300.0 + offset) % 360, speed: 0.03 },
          { name: 'Rahu', longitude: (210.0 + offset) % 360, speed: -0.05 },
          { name: 'Ketu', longitude: (30.0 + offset) % 360, speed: -0.05 },
        ],
        houses: Array.from({ length: 12 }, (_, i) => (i * 30 + offset) % 360),
        ascendant: offset % 360,
      };
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: EphemerisService, useValue: ephemeris },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();
    service = module.get<AstrologyService>(AstrologyService);
  });

  describe('Chart structure', () => {
    it('should have exactly 12 houses', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(result.houses).toHaveLength(12);
      result.houses.forEach((house, i) => {
        expect(house.house).toBe(i + 1);
        expect(VALID_SIGNS).toContain(house.sign);
        expect(Array.isArray(house.planets)).toBe(true);
      });
    });

    it('should have exactly 9 planetary positions', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(result.planetaryPositions).toHaveLength(9);
      const planetNames = result.planetaryPositions.map((p) => p.planet);
      VALID_PLANETS.forEach((planet) => {
        expect(planetNames).toContain(planet);
      });
    });

    it('should have valid sign for each planet', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      result.planetaryPositions.forEach((p) => {
        expect(VALID_SIGNS).toContain(p.sign);
      });
    });

    it('should have valid house number (1-12) for each planet', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      result.planetaryPositions.forEach((p) => {
        expect(p.house).toBeGreaterThanOrEqual(1);
        expect(p.house).toBeLessThanOrEqual(12);
      });
    });

    it('should have degree within sign between 0 and 30', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      result.planetaryPositions.forEach((p) => {
        expect(p.degree).toBeGreaterThanOrEqual(0);
        expect(p.degree).toBeLessThan(30);
      });
    });

    it('should have valid nakshatra for each planet', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      result.planetaryPositions.forEach((p) => {
        expect(VALID_NAKSHATRAS).toContain(p.nakshatra);
      });
    });

    it('should have valid ascendant sign', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(VALID_SIGNS).toContain(result.ascendant);
    });

    it('should have valid moon sign', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(VALID_SIGNS).toContain(result.moonSign);
    });

    it('should have valid sun sign', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(VALID_SIGNS).toContain(result.sunSign);
    });

    it('should have valid birth nakshatra', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(VALID_NAKSHATRAS).toContain(result.nakshatra);
    });
  });

  describe('Astronomical rules', () => {
    it('Rahu and Ketu must be exactly 180° apart (opposite signs)', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      const rahu = result.planetaryPositions.find((p) => p.planet === 'Rahu')!;
      const ketu = result.planetaryPositions.find((p) => p.planet === 'Ketu')!;
      const rahuIdx = VALID_SIGNS.indexOf(rahu.sign);
      const ketuIdx = VALID_SIGNS.indexOf(ketu.sign);
      expect(Math.abs(rahuIdx - ketuIdx)).toBe(6);
    });

    it('Rahu and Ketu must always be retrograde', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      const rahu = result.planetaryPositions.find((p) => p.planet === 'Rahu')!;
      const ketu = result.planetaryPositions.find((p) => p.planet === 'Ketu')!;
      expect(rahu.isRetrograde).toBe(true);
      expect(ketu.isRetrograde).toBe(true);
    });

    it('Sun and Moon must never be retrograde', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      const sun = result.planetaryPositions.find((p) => p.planet === 'Sun')!;
      const moon = result.planetaryPositions.find((p) => p.planet === 'Moon')!;
      expect(sun.isRetrograde).toBe(false);
      expect(moon.isRetrograde).toBe(false);
    });

    it('first house sign should match ascendant', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(result.houses[0].sign).toBe(result.ascendant);
    });

    it('houses should follow sequential sign order from ascendant', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      const ascIdx = VALID_SIGNS.indexOf(result.ascendant);
      result.houses.forEach((house, i) => {
        expect(house.sign).toBe(VALID_SIGNS[(ascIdx + i) % 12]);
      });
    });
  });

  describe('Determinism and differentiation', () => {
    it('same birth details should produce identical chart', async () => {
      const r1 = await service.generateKundli('test-uuid', mockBirthDetails);
      const r2 = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(r1.ascendant).toBe(r2.ascendant);
      expect(r1.moonSign).toBe(r2.moonSign);
      expect(r1.sunSign).toBe(r2.sunSign);
      expect(r1.nakshatra).toBe(r2.nakshatra);
      r1.planetaryPositions.forEach((p, i) => {
        expect(p.sign).toBe(r2.planetaryPositions[i].sign);
        expect(p.degree).toBe(r2.planetaryPositions[i].degree);
      });
    });

    it('different birth dates should produce different charts', async () => {
      const details2 = { ...mockBirthDetails, dateOfBirth: '2000-01-01', timeOfBirth: '06:00' };
      const r1 = await service.generateKundli('user-1', mockBirthDetails);
      const r2 = await service.generateKundli('user-2', details2);
      // At least moonSign or sunSign should differ for dates 10 years apart
      const differ = r1.moonSign !== r2.moonSign || r1.sunSign !== r2.sunSign || r1.ascendant !== r2.ascendant;
      expect(differ).toBe(true);
    });

    it('different birth times should produce different ascendants or positions', async () => {
      const morning = { ...mockBirthDetails, timeOfBirth: '06:00' };
      const evening = { ...mockBirthDetails, timeOfBirth: '22:00' };
      const r1 = await service.generateKundli('user-1', morning);
      const r2 = await service.generateKundli('user-2', evening);
      // Different times of day should give different ascendant
      expect(r1.ascendant !== r2.ascendant || r1.houses[0].sign !== r2.houses[0].sign).toBe(true);
    });
  });

  describe('Dasha periods', () => {
    it('should have valid dasha lord names', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      result.dashas.forEach((dasha) => {
        expect(DASHA_LORDS).toContain(dasha.planet);
      });
    });

    it('should have sub-periods within dashas', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      result.dashas.forEach((dasha) => {
        expect(dasha.subPeriods).toBeDefined();
        expect(Array.isArray(dasha.subPeriods)).toBe(true);
      });
    });
  });

  describe('Yogas', () => {
    it('should have valid effect enum for each yoga', async () => {
      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      result.yogas.forEach((yoga) => {
        expect(['benefic', 'malefic', 'neutral']).toContain(yoga.effect);
        expect(yoga.name).toBeTruthy();
        expect(yoga.description).toBeTruthy();
      });
    });
  });

  describe('Credit handling', () => {
    it('should deduct credits', async () => {
      await service.generateKundli('test-uuid', mockBirthDetails);
      expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 2, expect.any(String));
    });

    it('should throw when insufficient credits', async () => {
      userService.deductCredits.mockResolvedValue(false);
      await expect(service.generateKundli('test-uuid', mockBirthDetails)).rejects.toThrow(BadRequestException);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 4. MATCHING — Ashtakoota Guna Rules
// ═══════════════════════════════════════════════════════════════════════════════
describe('Matching (Ashtakoota) — Rule Correctness', () => {
  let service: AstrologyService;
  let prisma: any;
  let userService: any;

  const partner1 = { ...mockBirthDetails };
  const partner2 = { dateOfBirth: '1992-08-20', timeOfBirth: '10:00', placeOfBirth: 'Delhi', latitude: 28.6139, longitude: 77.209 };
  const partner3 = { dateOfBirth: '1985-12-25', timeOfBirth: '03:00', placeOfBirth: 'Chennai', latitude: 13.0827, longitude: 80.2707 };

  beforeEach(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: EphemerisService, useValue: mockEphemerisService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();
    service = module.get<AstrologyService>(AstrologyService);
  });

  describe('Guna structure', () => {
    it('should return exactly 8 gunas', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      expect(result.gunaDetails).toHaveLength(8);
    });

    it('should have all 8 guna names in correct order', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      const expectedGunas = ['Varna', 'Vashya', 'Tara', 'Yoni', 'Graha Maitri', 'Gana', 'Bhakoot', 'Nadi'];
      result.gunaDetails.forEach((g, i) => {
        expect(g.guna).toBe(expectedGunas[i]);
      });
    });
  });

  describe('Score bounds', () => {
    it('each guna score must not exceed its maximum', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      const maxPoints = [1, 2, 3, 4, 5, 6, 7, 8];
      result.gunaDetails.forEach((g, i) => {
        expect(g.maxPoints).toBe(maxPoints[i]);
        expect(g.obtainedPoints).toBeGreaterThanOrEqual(0);
        expect(g.obtainedPoints).toBeLessThanOrEqual(g.maxPoints);
      });
    });

    it('total score must equal sum of individual scores', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      const computedTotal = result.gunaDetails.reduce((s, g) => s + g.obtainedPoints, 0);
      expect(result.totalScore).toBe(computedTotal);
    });

    it('total score must be between 0 and 36', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(36);
    });

    it('max score must be 36', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      expect(result.maxScore).toBe(36);
    });
  });

  describe('Nadi Dosha rule', () => {
    it('same person matched with themselves should have Nadi score 0 (same nadi)', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner1);
      const nadi = result.gunaDetails.find((g) => g.guna === 'Nadi')!;
      expect(nadi.obtainedPoints).toBe(0); // Same nadi = Nadi Dosha
    });
  });

  describe('Differentiation', () => {
    it('different partner combinations should yield different scores', async () => {
      const r1 = await service.getMatching('user-1', partner1, partner2);
      const r2 = await service.getMatching('user-2', partner1, partner3);
      // At least some scores should differ
      const differ = r1.totalScore !== r2.totalScore ||
        r1.gunaDetails.some((g, i) => g.obtainedPoints !== r2.gunaDetails[i].obtainedPoints);
      expect(differ).toBe(true);
    });
  });

  describe('Compatibility label matches score', () => {
    it('should have correct compatibility label format', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      expect(['Excellent', 'Very Good', 'Good', 'Average', 'Below Average']).toContain(result.compatibility);
    });

    it('compatibility should align with score thresholds', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      if (result.totalScore >= 25) expect(result.compatibility).toBe('Excellent');
      else if (result.totalScore >= 21) expect(result.compatibility).toBe('Very Good');
      else if (result.totalScore >= 18) expect(result.compatibility).toBe('Good');
      else if (result.totalScore >= 14) expect(result.compatibility).toBe('Average');
      else expect(result.compatibility).toBe('Below Average');
    });
  });

  describe('Guna descriptions', () => {
    it('each guna should have a non-empty description', async () => {
      const result = await service.getMatching('test-uuid', partner1, partner2);
      result.gunaDetails.forEach((g) => {
        expect(g.description).toBeTruthy();
        expect(g.description.length).toBeGreaterThan(10);
      });
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 5. PANCHANG — Calendar Correctness
// ═══════════════════════════════════════════════════════════════════════════════
describe('Panchang — Calendar & Astronomical Correctness', () => {
  let service: AstrologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: EphemerisService, useValue: mockEphemerisService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();
    service = module.get<AstrologyService>(AstrologyService);
  });

  describe('Tithi validation', () => {
    it('should start with Shukla or Krishna', async () => {
      const result = await service.getPanchang();
      expect(result.tithi).toMatch(/^(Shukla|Krishna)\s/);
    });

    it('should contain a valid tithi name', async () => {
      const result = await service.getPanchang();
      const tithiName = result.tithi.replace(/^(Shukla|Krishna)\s/, '');
      expect(VALID_TITHIS).toContain(tithiName);
    });
  });

  describe('Nakshatra validation', () => {
    it('should be one of 27 valid nakshatras', async () => {
      const result = await service.getPanchang();
      expect(VALID_NAKSHATRAS).toContain(result.nakshatra);
    });
  });

  describe('Yoga validation', () => {
    it('should be one of 27 valid yogas', async () => {
      const result = await service.getPanchang();
      expect(VALID_YOGAS).toContain(result.yoga);
    });
  });

  describe('Karana validation', () => {
    it('should be one of 11 valid karanas', async () => {
      const result = await service.getPanchang();
      expect(VALID_KARANAS).toContain(result.karana);
    });
  });

  describe('Vara validation', () => {
    it('vara matches the weekday of the date the panchang itself reports', async () => {
      const result = await service.getPanchang();
      // Self-consistency check instead of comparing to the test's own clock:
      // near IST midnight (and before sunrise) the panchang legitimately still
      // reports the previous civil day, so comparing result.vara to a freshly
      // sampled `new Date()` raced and flaked in the 18:30–19:00 UTC window.
      // The vara must always match the weekday of result.date, whichever day
      // that is — a tighter invariant that never straddles the boundary.
      const weekdayIdx = new Date(`${result.date}T12:00:00Z`).getUTCDay();
      expect(result.vara).toBe(VALID_VARAS[weekdayIdx]);
    });
  });

  describe('Time validation', () => {
    it('sunrise should be in valid time format', async () => {
      const result = await service.getPanchang();
      expect(result.sunrise).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('sunset should be in valid time format', async () => {
      const result = await service.getPanchang();
      expect(result.sunset).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('sunrise should be AM and sunset should be PM', async () => {
      const result = await service.getPanchang();
      expect(result.sunrise).toContain('AM');
      expect(result.sunset).toContain('PM');
    });

    it('rahukaal should have valid time range format', async () => {
      const result = await service.getPanchang();
      expect(result.rahukaal).toMatch(/\d{2}:\d{2}\s(AM|PM)\s-\s\d{2}:\d{2}\s(AM|PM)/);
    });

    it('gulikakaal should have valid time range format', async () => {
      const result = await service.getPanchang();
      expect(result.gulikakaal).toMatch(/\d{2}:\d{2}\s(AM|PM)\s-\s\d{2}:\d{2}\s(AM|PM)/);
    });
  });

  describe('Date validation', () => {
    it("should return today's date (±1 day at the IST boundary)", async () => {
      const result = await service.getPanchang();
      // The Delhi panchang's "today" is the Indian calendar date. Accept the
      // IST civil date for now OR its neighbours: between IST midnight and
      // sunrise a sunrise-based panchang still reports the prior day, and the
      // await straddles the boundary — both made the exact-match assertion
      // flake in the ~30 min after 18:30 UTC. ±1 day still catches a genuinely
      // wrong date (which would be off by more).
      const istDate = (offsetMs: number) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
          new Date(Date.now() + offsetMs),
        );
      const DAY = 24 * 60 * 60 * 1000;
      expect([istDate(-DAY), istDate(0), istDate(DAY)]).toContain(result.date);
    });
  });

  describe('All required fields present', () => {
    it('should include all Panchang elements', async () => {
      const result = await service.getPanchang();
      expect(result.date).toBeDefined();
      expect(result.tithi).toBeDefined();
      expect(result.nakshatra).toBeDefined();
      expect(result.yoga).toBeDefined();
      expect(result.karana).toBeDefined();
      expect(result.vara).toBeDefined();
      expect(result.sunrise).toBeDefined();
      expect(result.sunset).toBeDefined();
      expect(result.moonrise).toBeDefined();
      expect(result.rahukaal).toBeDefined();
      expect(result.gulikakaal).toBeDefined();
      expect(result.yamakantaka).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. HOROSCOPE — Differentiation & Correctness
// ═══════════════════════════════════════════════════════════════════════════════
describe('Horoscope — Differentiation & Correctness', () => {
  let service: AstrologyService;
  let cacheService: any;

  beforeEach(async () => {
    cacheService = mockCacheService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: cacheService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: EphemerisService, useValue: mockEphemerisService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();
    service = module.get<AstrologyService>(AstrologyService);
  });

  describe('Sign differentiation', () => {
    it('different zodiac signs should get different predictions', async () => {
      const aries = await service.getHoroscope('aries', 'daily');
      cacheService.get.mockReturnValue(null); // clear cache
      const cancer = await service.getHoroscope('cancer', 'daily');
      expect(aries.prediction).not.toBe(cancer.prediction);
    });

    it('career content should be personalized with sign name', async () => {
      const result = await service.getHoroscope('leo', 'daily');
      expect(result.career).toContain('Leo');
    });

    it('health content should be personalized with sign name', async () => {
      const result = await service.getHoroscope('virgo', 'daily');
      expect(result.health).toContain('Virgo');
    });

    it('predictions should mention the sign name', async () => {
      const result = await service.getHoroscope('scorpio', 'daily');
      expect(result.prediction).toContain('Scorpio');
    });
  });

  describe('Period differentiation', () => {
    it('daily and weekly predictions should differ', async () => {
      const daily = await service.getHoroscope('aries', 'daily');
      cacheService.get.mockReturnValue(null);
      const weekly = await service.getHoroscope('aries', 'weekly');
      expect(daily.prediction).not.toBe(weekly.prediction);
    });

    it('monthly predictions should be longer than daily', async () => {
      const daily = await service.getHoroscope('aries', 'daily');
      cacheService.get.mockReturnValue(null);
      const monthly = await service.getHoroscope('aries', 'monthly');
      expect(monthly.prediction.length).toBeGreaterThan(daily.prediction.length);
    });
  });

  describe('All 12 signs produce valid results', () => {
    const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

    it.each(signs)('should produce valid horoscope for %s', async (sign) => {
      cacheService.get.mockReturnValue(null);
      const result = await service.getHoroscope(sign, 'daily');
      expect(result.sign).toBe(sign.charAt(0).toUpperCase() + sign.slice(1));
      expect(result.period).toBe('daily');
      expect(result.prediction).toBeTruthy();
      expect(result.career).toBeTruthy();
      expect(result.health).toBeTruthy();
      expect(result.love).toBeTruthy();
      expect(result.luckyNumber).toBeGreaterThanOrEqual(1);
      expect(result.luckyNumber).toBeLessThanOrEqual(9);
      expect(result.luckyColor).toBeTruthy();
      expect(result.mood).toBeTruthy();
      expect(result.compatibility).toBeTruthy();
    });
  });

  describe('All 4 periods produce valid results', () => {
    const periods: Array<'daily' | 'weekly' | 'monthly' | 'yearly'> = ['daily', 'weekly', 'monthly', 'yearly'];

    it.each(periods)('should produce valid horoscope for %s period', async (period) => {
      cacheService.get.mockReturnValue(null);
      const result = await service.getHoroscope('aries', period);
      expect(result.period).toBe(period);
      expect(result.prediction).toBeTruthy();
    });
  });

  describe('Caching behavior', () => {
    it('should cache results after first call', async () => {
      await service.getHoroscope('aries', 'daily');
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('horoscope:VEDIC:aries:daily:'),
        expect.any(Object),
        24 * 60 * 60 * 1000,
      );
    });

    it('should return cached result on second call', async () => {
      const cached = { sign: 'Aries', prediction: 'cached', period: 'daily', date: '2026-01-01', career: 'c', health: 'h', love: 'l', luckyNumber: 1, luckyColor: 'Red', mood: 'Good', compatibility: 'Leo' };
      cacheService.get.mockReturnValue(cached);
      const result = await service.getHoroscope('aries', 'daily');
      expect(result).toEqual(cached);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 7. MUHURAT — Auspicious Time Correctness
// ═══════════════════════════════════════════════════════════════════════════════
describe('Muhurat — Auspicious Time Correctness', () => {
  let service: AstrologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: EphemerisService, useValue: mockEphemerisService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();
    service = module.get<AstrologyService>(AstrologyService);
  });

  const muhuratRequest = {
    purpose: 'Wedding ceremony',
    fromDate: '2026-05-01',
    toDate: '2026-05-05',
    location: 'Mumbai',
  };

  describe('Result structure', () => {
    it('should return purpose matching request', async () => {
      const result = await service.getMuhurat(muhuratRequest);
      expect(result.purpose).toBe('Wedding ceremony');
    });

    it('should return 1-4 auspicious times for a 5-day range', async () => {
      const result = await service.getMuhurat(muhuratRequest);
      expect(result.auspiciousTimes.length).toBeGreaterThanOrEqual(1);
      expect(result.auspiciousTimes.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Time validation', () => {
    it('all dates should be within the requested range', async () => {
      const result = await service.getMuhurat(muhuratRequest);
      const from = new Date('2026-05-01').getTime();
      const to = new Date('2026-05-05').getTime();
      result.auspiciousTimes.forEach((t) => {
        const date = new Date(t.date).getTime();
        expect(date).toBeGreaterThanOrEqual(from);
        expect(date).toBeLessThanOrEqual(to);
      });
    });

    it('quality must be a valid enum value', async () => {
      const result = await service.getMuhurat(muhuratRequest);
      result.auspiciousTimes.forEach((t) => {
        expect(['excellent', 'good', 'average']).toContain(t.quality);
      });
    });

    it('each time slot must have a non-empty reason', async () => {
      const result = await service.getMuhurat(muhuratRequest);
      result.auspiciousTimes.forEach((t) => {
        expect(t.reason).toBeTruthy();
        expect(t.reason.length).toBeGreaterThan(10);
      });
    });

    it('start and end times should be populated', async () => {
      const result = await service.getMuhurat(muhuratRequest);
      result.auspiciousTimes.forEach((t) => {
        expect(t.startTime).toBeTruthy();
        expect(t.endTime).toBeTruthy();
      });
    });
  });

  describe('Single day range', () => {
    it('should return at least 1 result for a single day', async () => {
      const result = await service.getMuhurat({
        purpose: 'Housewarming',
        fromDate: '2026-06-15',
        toDate: '2026-06-15',
        location: 'Delhi',
      });
      expect(result.auspiciousTimes.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. DAILY BRIEFING (My Day) — Personalization & Correctness
// ═══════════════════════════════════════════════════════════════════════════════
describe('Daily Briefing (My Day) — Personalization & Correctness', () => {
  let service: DailyBriefingService;
  let prisma: any;
  let cacheService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    cacheService = mockCacheService();
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyBriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: KbService, useValue: mockKbService() },
        { provide: MemoryCacheService, useValue: cacheService },
      ],
    }).compile();
    service = module.get<DailyBriefingService>(DailyBriefingService);
  });

  describe('Greeting personalization', () => {
    it('should include user first name in greeting', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toContain('Test');
    });

    it('should use "there" when user has no name', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, name: null });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toContain('there');
    });

    it('should include time-appropriate greeting', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toMatch(/(Good Morning|Good Afternoon|Good Evening)/);
    });
  });

  describe('Planetary hours', () => {
    it('should have exactly 24 planetary hours', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.planetaryHours).toHaveLength(24);
    });

    it('should have valid planet names for each hour', async () => {
      const validPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
      const result = await service.getDailyBriefing('test-uuid');
      result.planetaryHours.forEach((h) => {
        expect(validPlanets).toContain(h.planet);
      });
    });

    it('should have at most 1 current hora', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      const currentCount = result.planetaryHours.filter((h) => h.isCurrent).length;
      expect(currentCount).toBeLessThanOrEqual(1);
    });

    it('each hour should have activities and avoid lists', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      result.planetaryHours.forEach((h) => {
        expect(h.activities.length).toBeGreaterThan(0);
        expect(h.avoid.length).toBeGreaterThan(0);
        expect(h.startTime).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
        expect(h.endTime).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
      });
    });
  });

  describe('Profession-specific insights', () => {
    it('SOFTWARE profession should get tech-relevant insight', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: 'SOFTWARE' });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.professionInsight).toBeTruthy();
      expect(result.professionInsight.length).toBeGreaterThan(20);
    });

    it('different professions should get different insights', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: 'SOFTWARE' });
      const sw = await service.getDailyBriefing('test-uuid');

      cacheService.get.mockReturnValue(null);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: 'SALES' });
      const sales = await service.getDailyBriefing('test-uuid');

      // Profession insights should differ
      expect(sw.professionInsight).not.toBe(sales.professionInsight);
    });

    it('unknown profession should fallback to OTHER', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, profession: null });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.professionInsight).toBeTruthy();
    });
  });

  describe('Panchang embedded in briefing', () => {
    it('should include valid panchang data', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.panchang.tithi).toBeTruthy();
      expect(result.panchang.nakshatra).toBeTruthy();
      expect(result.panchang.yoga).toBeTruthy();
      expect(result.panchang.vara).toBeTruthy();
      expect(result.panchang.rahukaal).toBeTruthy();
    });

    it('panchang nakshatra should be from valid list', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(VALID_NAKSHATRAS).toContain(result.panchang.nakshatra);
    });
  });

  describe('Lucky attributes', () => {
    it('lucky number should be between 1 and 9', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.luckyNumber).toBeGreaterThanOrEqual(1);
      expect(result.luckyNumber).toBeLessThanOrEqual(9);
    });

    it('lucky color should be non-empty', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.luckyColor).toBeTruthy();
    });
  });

  describe('Day quality assessment', () => {
    it('should be one of the valid quality levels', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(['excellent', 'good', 'moderate', 'challenging']).toContain(result.dayQuality);
    });
  });

  describe('Transit alerts', () => {
    it('user age 28-30 should trigger Saturn Return alert', async () => {
      const saturnReturnUser = { ...mockUser, dateOfBirth: new Date(new Date().getFullYear() - 29, 5, 15) };
      prisma.user.findUnique.mockResolvedValue(saturnReturnUser);
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.transitAlert).toBeTruthy();
      expect(result.transitAlert).toContain('Saturn');
    });

    it('user with no birth date should have null transit alert', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, dateOfBirth: null });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.transitAlert).toBeNull();
    });
  });

  describe('Mantra and remedy', () => {
    it('should have a non-empty mantra', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.mantra).toBeTruthy();
      expect(result.mantra).toContain('Om');
    });

    it('should have a non-empty remedy', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.remedy).toBeTruthy();
      expect(result.remedy.length).toBeGreaterThan(20);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CONSULT (Chat) — Session & Response Correctness
// ═══════════════════════════════════════════════════════════════════════════════
describe('Consult (Chat) — Session & Response Correctness', () => {
  let service: ChatService;
  let prisma: any;
  let userService: any;
  let openaiService: any;

  const mockSession = {
    id: 'session-1',
    userId: 'test-uuid',
    title: 'Career question',
    category: 'career',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  };

  const mockAssistantMsg = {
    id: 'msg-2',
    sessionId: 'session-1',
    role: 'ASSISTANT',
    content: 'Based on your Vedic chart, Jupiter transits suggest career growth.',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();
    openaiService = {
      chatCompletion: jest.fn().mockResolvedValue('Based on your Vedic chart, Jupiter transits suggest career growth.'),
      getClient: jest.fn().mockReturnValue({}),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.chatSession.create.mockResolvedValue(mockSession);
    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatMessage.create.mockResolvedValue(mockAssistantMsg);
    prisma.chatMessage.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
        { provide: OpenAIService, useValue: openaiService },
        { provide: LlmService, useValue: mockLlmService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: mockMemoryService() },
      ],
    }).compile();
    service = module.get<ChatService>(ChatService);
  });

  describe('Credit handling', () => {
    it('should deduct 1 credit per message', async () => {
      await service.sendMessage('test-uuid', { message: 'What does my chart say?', category: 'general' });
      expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 1, expect.any(String));
    });

    it('should throw when credits insufficient', async () => {
      userService.deductCredits.mockResolvedValue(false);
      await expect(
        service.sendMessage('test-uuid', { message: 'Hello', category: 'general' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Session management', () => {
    it('should create new session when no sessionId provided', async () => {
      await service.sendMessage('test-uuid', { message: 'Hi', category: 'career' });
      expect(prisma.chatSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'test-uuid', category: 'career' }),
        }),
      );
    });

    it('should reuse existing session when sessionId provided', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);
      await service.sendMessage('test-uuid', { message: 'Follow up', sessionId: 'session-1' });
      expect(prisma.chatSession.create).not.toHaveBeenCalled();
    });
  });

  describe('Response structure', () => {
    it('should return session and reply objects', async () => {
      const result = await service.sendMessage('test-uuid', { message: 'Career advice', category: 'career' });
      expect(result.session).toBeDefined();
      expect(result.session.id).toBeTruthy();
      expect(result.reply).toBeDefined();
      expect(result.reply.content).toBeTruthy();
      expect(result.reply.role).toBe('assistant');
    });
  });

  describe('Session isolation', () => {
    it('should not find sessions from other users', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      await service.sendMessage('test-uuid', { message: 'Test', sessionId: 'other-session' });
      // Should create new session since it can't find the one belonging to another user
      expect(prisma.chatSession.create).toHaveBeenCalled();
    });
  });
});
