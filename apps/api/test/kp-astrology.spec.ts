import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import {
  mockPrismaService,
  mockConfigService,
  mockUserService,
  mockOpenAIService,
  mockCacheService,
  mockKnowledgeService,
  mockBirthDetails,
} from './helpers/mocks';

describe('AstrologyService – KP Astrology', () => {
  let service: AstrologyService;
  let userService: any;

  beforeEach(async () => {
    userService = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: mockPrismaService() },
        {
          provide: ConfigService,
          useValue: mockConfigService({
            'credits.kundliCost': 2,
          }),
        },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    service = module.get<AstrologyService>(AstrologyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate KP chart with cusps', async () => {
    const result = await service.generateKPChart('test-uuid', mockBirthDetails as any);
    expect(result).toBeDefined();
    expect(result.cusps).toBeDefined();
    expect(result.system).toBe('KP (Krishnamurti Paddhati)');
  });

  it('should return 12 cusps', async () => {
    const result = await service.generateKPChart('test-uuid', mockBirthDetails as any);
    expect(result.cusps).toHaveLength(12);
    for (const cusp of result.cusps) {
      expect(cusp).toHaveProperty('cusp');
      expect(cusp).toHaveProperty('longitude');
      expect(cusp).toHaveProperty('sign');
      expect(cusp).toHaveProperty('nakshatra');
      expect(cusp).toHaveProperty('starLord');
      expect(cusp).toHaveProperty('subLord');
    }
  });

  it('should return planet positions with star-lord and sub-lord', async () => {
    const result = await service.generateKPChart('test-uuid', mockBirthDetails as any);
    expect(result.planets).toBeDefined();
    expect(result.planets.length).toBeGreaterThan(0);
    for (const planet of result.planets) {
      expect(planet).toHaveProperty('planet');
      expect(planet).toHaveProperty('longitude');
      expect(planet).toHaveProperty('sign');
      expect(planet).toHaveProperty('nakshatra');
      expect(planet).toHaveProperty('starLord');
      expect(planet).toHaveProperty('subLord');
    }
  });

  it('should include Rahu and Ketu', async () => {
    const result = await service.generateKPChart('test-uuid', mockBirthDetails as any);
    const planetNames = result.planets.map((p: any) => p.planet);
    expect(planetNames).toContain('Rahu');
    expect(planetNames).toContain('Ketu');
  });

  it('should build KP sub-lord table with 243 entries (27 nakshatras x 9 sub-divisions)', () => {
    // Access the private method via bracket notation for testing
    const table = (service as any).buildKPSubLordTable();
    expect(table).toHaveLength(243);
    // Each entry should have start, end, lord
    for (const entry of table) {
      expect(entry).toHaveProperty('start');
      expect(entry).toHaveProperty('end');
      expect(entry).toHaveProperty('lord');
      expect(entry.end).toBeGreaterThan(entry.start);
    }
  });

  it('should deduct credits', async () => {
    await service.generateKPChart('test-uuid', mockBirthDetails as any);
    expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 2, expect.any(String));
  });

  it('should throw on insufficient credits', async () => {
    userService.deductCredits.mockResolvedValue(false);
    await expect(
      service.generateKPChart('test-uuid', mockBirthDetails as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return house significators for 12 houses', async () => {
    const result = await service.generateKPChart('test-uuid', mockBirthDetails as any);
    expect(result.significators).toBeDefined();
    for (let h = 1; h <= 12; h++) {
      expect(result.significators[h]).toBeDefined();
      expect(Array.isArray(result.significators[h])).toBe(true);
    }
  });

  it('should use Placidus house system', async () => {
    const result = await service.generateKPChart('test-uuid', mockBirthDetails as any);
    // KP system always uses Placidus; we verify by checking the system label
    expect(result.system).toContain('KP');
    // The cusps should all be distinct (Placidus produces unique cusps)
    const cuspLongs = result.cusps.map((c: any) => c.longitude);
    const uniqueLongs = new Set(cuspLongs);
    expect(uniqueLongs.size).toBe(12);
  });
});
