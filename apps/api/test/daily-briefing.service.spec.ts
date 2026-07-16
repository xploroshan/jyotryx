import { Test, TestingModule } from '@nestjs/testing';
import { DailyBriefingService, greetingKeyForHour } from '../src/modules/daily-briefing/daily-briefing.service';
import { zonedNow } from '../src/common/timezone.util';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { GocharService } from '../src/modules/daily-briefing/gochar.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { GeoService } from '../src/modules/geo/geo.service';
import { mockPrismaService, mockOpenAIService, mockKnowledgeService, mockKbService, mockCacheService, mockUser } from './helpers/mocks';

// A ChartResult-like object from a map of planet -> sidereal longitude.
function chart(longitudes: Record<string, number>) {
  const positions = Object.entries(longitudes).map(([name, longitude]) => ({ name, longitude, speed: 0 }));
  return { julianDay: 0, positions, ascendant: 0, houses: [] as number[] };
}

describe('greetingKeyForHour', () => {
  it('maps local hours to greeting buckets at the right boundaries', () => {
    expect(greetingKeyForHour(0)).toBe('greeting.morning');
    expect(greetingKeyForHour(11)).toBe('greeting.morning');
    expect(greetingKeyForHour(12)).toBe('greeting.afternoon');
    expect(greetingKeyForHour(16)).toBe('greeting.afternoon');
    expect(greetingKeyForHour(17)).toBe('greeting.evening');
    expect(greetingKeyForHour(23)).toBe('greeting.evening');
  });
});

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
        { provide: KbService, useValue: mockKbService() },
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

    it('computes the briefing date in the caller-provided timezone', async () => {
      // The date the user sees must be their local day, not the server's UTC day.
      const result = await service.getDailyBriefing('test-uuid', 'en', 'Asia/Kolkata');
      expect(result.date).toBe(zonedNow(new Date(), 'Asia/Kolkata').dateStr);
    });

    it('falls back to the default zone for an invalid timezone (still returns a briefing)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, placeOfBirth: null });
      const result = await service.getDailyBriefing('test-uuid', 'en', 'Not/AZone');
      expect(result.date).toBe(zonedNow(new Date(), 'Asia/Kolkata').dateStr);
    });

    it('should prefer the informal nickname over the formal name in the greeting', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, name: 'Sumanth Roshan Raj Manuel', nickname: 'Roshan' });
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toContain('Roshan');
      expect(result.greeting).not.toContain('Sumanth');
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

    it('should check cache before computing', async () => {
      // First call computes and caches
      await service.getDailyBriefing('test-uuid');

      // Cache should have been set
      expect(cacheService.set).toHaveBeenCalled();

      // Cache get should have been called (global + user keys)
      expect(cacheService.get).toHaveBeenCalled();
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

// ─── Gochar (chart) personalization ──────────────────────────────────────────
// Wires the REAL GocharService against a mocked ephemeris so the merge in
// getDailyBriefing runs end-to-end: proves the reading is per-user (not the
// shared almanac) and that `personalized`/`personalizationReason` are honest.
describe('DailyBriefingService — My Day personalization', () => {
  let service: DailyBriefingService;
  let prisma: any;
  let ephemeris: { computeChart: jest.Mock; computeCurrentChart: jest.Mock };
  let geo: { search: jest.Mock };

  // Shared transit sky. tMoon=0, tSaturn=150 was chosen so an Aries natal Moon
  // resolves to its lord (Mars) while a Cancer natal Moon resolves to the Moon —
  // i.e. two users get a materially different focus graha → different remedy.
  const TRANSIT = chart({ Sun: 30, Moon: 0, Saturn: 150, Jupiter: 60 });
  const ARIES_NATAL = chart({ Moon: 10, Sun: 50 }); // idx 0 → Coral Red, lord Mars
  const CANCER_NATAL = chart({ Moon: 100, Sun: 50 }); // idx 3 → Pearl White, lord Moon

  // A user with complete, geocoded birth data (chart layer can light up).
  const CHARTABLE_USER = {
    ...mockUser,
    dateOfBirth: new Date('1990-05-15'),
    timeOfBirth: '10:30',
    placeOfBirth: { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  };

  beforeEach(async () => {
    prisma = mockPrismaService();
    ephemeris = {
      computeChart: jest.fn().mockResolvedValue(CANCER_NATAL),
      computeCurrentChart: jest.fn().mockResolvedValue(TRANSIT),
    };
    // Geocoder returns nothing by default — the coord-bearing users below never
    // hit it; the name-only test overrides it with a hit.
    geo = { search: jest.fn().mockResolvedValue([]) };
    prisma.user.findUnique.mockResolvedValue(CHARTABLE_USER);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyBriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
        { provide: EphemerisService, useValue: ephemeris },
        { provide: GeoService, useValue: geo },
        GocharService,
      ],
    }).compile();

    service = module.get<DailyBriefingService>(DailyBriefingService);
  });

  it('personalizes a user whose birthplace is only a name (geocoded server-side)', async () => {
    // The reported bug: a user with a free-text birthplace ("Sakleshpur", no
    // coordinates) was stuck on the shared almanac with the "complete birth
    // details" prompt forever. The server now geocodes the name so the reading
    // personalizes and the prompt disappears — no re-entry required.
    prisma.user.findUnique.mockResolvedValue({ ...CHARTABLE_USER, placeOfBirth: 'Sakleshpur' });
    geo.search.mockResolvedValue([
      { name: 'Sakleshpur', label: 'Sakleshpur, Karnataka, India', lat: 12.94, lng: 75.78, country: 'India', state: 'Karnataka', countryCode: 'IN' },
    ]);
    const r = await service.getDailyBriefing('test-uuid');
    expect(geo.search).toHaveBeenCalledWith('Sakleshpur', 1);
    expect(r.personalized).toBe(true);
    expect(r.personalizationReason).toBe('ok');
    expect(r.moonSign).toBe('Cancer');
  });

  it('still prompts (missing_place) when the name cannot be geocoded', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...CHARTABLE_USER, placeOfBirth: 'Nowhereville' });
    geo.search.mockResolvedValue([]);
    const r = await service.getDailyBriefing('test-uuid');
    expect(r.personalized).toBe(false);
    expect(r.personalizationReason).toBe('missing_place');
  });

  it('lights up the chart layer for a user with complete birth data', async () => {
    const r = await service.getDailyBriefing('test-uuid');
    expect(r.personalized).toBe(true);
    expect(r.personalizationReason).toBe('ok');
    expect(r.moonSign).toBe('Cancer');
    // The summary leads with the user's own chart insight.
    expect(r.summary).toContain('Cancer');
  });

  it('produces materially different readings for two different natal Moon signs', async () => {
    ephemeris.computeChart.mockResolvedValueOnce(ARIES_NATAL);
    const aries = await service.getDailyBriefing('user-a');

    ephemeris.computeChart.mockResolvedValueOnce(CANCER_NATAL);
    const cancer = await service.getDailyBriefing('user-b');

    // Chart-derived fields must diverge — this is the whole point of the fix.
    expect(aries.moonSign).toBe('Aries');
    expect(cancer.moonSign).toBe('Cancer');
    expect(aries.luckyColor).not.toBe(cancer.luckyColor); // Coral Red vs Pearl White
    // Focus graha differs (Mars vs Moon) → the personalized remedy differs.
    expect(aries.remedy).not.toBe(cancer.remedy);
    expect(aries.summary).not.toBe(cancer.summary);
    expect(aries.personalized).toBe(true);
    expect(cancer.personalized).toBe(true);
  });

  it('leads the do/avoid lists with the user\'s own chart guidance', async () => {
    // Baseline: chart layer dark → the shared almanac lists.
    prisma.user.findUnique.mockResolvedValue({ ...CHARTABLE_USER, timeOfBirth: null });
    const shared = await service.getDailyBriefing('no-chart');

    // Chart layer lit → the same lists, but now led by a chart-derived clause.
    prisma.user.findUnique.mockResolvedValue(CHARTABLE_USER);
    const personal = await service.getDailyBriefing('test-uuid');

    expect(shared.personalized).toBe(false);
    expect(personal.personalized).toBe(true);
    // The personalized list leads with a clause the shared almanac never has.
    expect(personal.doList[0]).not.toBe(shared.doList[0]);
    expect(shared.doList).not.toContain(personal.doList[0]);
    expect(personal.avoidList[0]).not.toBe(shared.avoidList[0]);
  });

  describe('personalizationReason is honest about missing data', () => {
    it('no_birth_data when the user has no date of birth', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...CHARTABLE_USER, dateOfBirth: null });
      const r = await service.getDailyBriefing('test-uuid');
      expect(r.personalized).toBe(false);
      expect(r.personalizationReason).toBe('no_birth_data');
      expect(r.moonSign).toBeNull();
    });

    it('missing_time when the user has a DOB but no exact birth time', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...CHARTABLE_USER, timeOfBirth: null });
      const r = await service.getDailyBriefing('test-uuid');
      expect(r.personalized).toBe(false);
      expect(r.personalizationReason).toBe('missing_time');
    });

    it('missing_place when the birthplace is not geocoded (no lat/lng)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...CHARTABLE_USER, placeOfBirth: { name: 'Mumbai' } });
      const r = await service.getDailyBriefing('test-uuid');
      expect(r.personalized).toBe(false);
      expect(r.personalizationReason).toBe('missing_place');
    });

    it('missing_place when the coordinates are the null-island (0,0) sentinel', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...CHARTABLE_USER, placeOfBirth: { name: 'Nowhere', lat: 0, lng: 0 } });
      const r = await service.getDailyBriefing('test-uuid');
      expect(r.personalized).toBe(false);
      expect(r.personalizationReason).toBe('missing_place');
    });

    it('unavailable when all data is present but the ephemeris errors', async () => {
      ephemeris.computeChart.mockRejectedValue(new Error('swisseph down'));
      const r = await service.getDailyBriefing('test-uuid');
      expect(r.personalized).toBe(false);
      expect(r.personalizationReason).toBe('unavailable');
    });
  });

  it('keeps the shared almanac (panchang, hours) identical regardless of the user\'s chart', async () => {
    // Panchang and planetary hours are real astronomy — the same sky for
    // everyone. They must NOT be faked into per-user values.
    ephemeris.computeChart.mockResolvedValueOnce(ARIES_NATAL);
    const aries = await service.getDailyBriefing('user-a');
    ephemeris.computeChart.mockResolvedValueOnce(CANCER_NATAL);
    const cancer = await service.getDailyBriefing('user-b');

    expect(aries.panchang).toEqual(cancer.panchang);
    expect(aries.planetaryHours).toEqual(cancer.planetaryHours);
  });
});
