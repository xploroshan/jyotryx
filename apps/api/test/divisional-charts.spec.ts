import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import {
  mockPrismaService,
  mockConfigService,
  mockUserService,
  mockOpenAIService,
  mockCacheService,
  mockKnowledgeService,
  mockBirthDetails,
  mockEphemerisService,
} from './helpers/mocks';

describe('AstrologyService – Divisional Charts', () => {
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
        { provide: EphemerisService, useValue: mockEphemerisService() },
      ],
    }).compile();

    service = module.get<AstrologyService>(AstrologyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // D9 Navamsa: planet at 15deg Aries (signIdx=0, posInSign=15)
  // element = 0%4 = 0 (Fire), elementStart = 0 (Aries)
  // navamsaIdx = floor(15 / 3.333) = floor(4.5) = 4
  // navamsaSign = (0 + 4) % 12 = 4 => Leo
  it('D9 Navamsa: planet at 15deg Aries should be in Leo', () => {
    const result = service.computeDivisionalChart(
      [{ planet: 'Sun', longitude: 15 }],
      9,
    );
    expect(result[0].sign).toBe('Leo');
  });

  // D9 Navamsa: planet at 0deg Taurus (signIdx=1, posInSign=0)
  // element = 1%4 = 1 (Earth), elementStart = 9 (Capricorn)
  // navamsaIdx = floor(0 / 3.333) = 0
  // navamsaSign = (9 + 0) % 12 = 9 => Capricorn
  it('D9 Navamsa: planet at 0deg Taurus should be in Capricorn', () => {
    const result = service.computeDivisionalChart(
      [{ planet: 'Moon', longitude: 30 }], // 30deg = 0deg Taurus
      9,
    );
    expect(result[0].sign).toBe('Capricorn');
  });

  // D10 Dashamsha: planet at 6deg Aries (signIdx=0)
  // signIdx=0 is even, so startSign = 0 (Aries)
  // dashamshaIdx = floor(6/3) = 2
  // dashamshaSign = (0+2)%12 = 2 => Gemini
  it('D10 Dashamsha: planet at 6deg Aries should be in Gemini', () => {
    const result = service.computeDivisionalChart(
      [{ planet: 'Mars', longitude: 6 }],
      10,
    );
    expect(result[0].sign).toBe('Gemini');
  });

  it('should deduct credits for getDivisionalChart', async () => {
    await service.getDivisionalChart('test-uuid', mockBirthDetails as any, '9');
    expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 2, expect.any(String));
  });

  it('should throw on insufficient credits', async () => {
    userService.deductCredits.mockResolvedValue(false);
    await expect(
      service.getDivisionalChart('test-uuid', mockBirthDetails as any, '9'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw on invalid chart type (divisor=0 or >60)', async () => {
    // divisor=0 is invalid
    await expect(
      service.getDivisionalChart('test-uuid', mockBirthDetails as any, '0'),
    ).rejects.toThrow(BadRequestException);

    // divisor > 60 is invalid
    await expect(
      service.getDivisionalChart('test-uuid', mockBirthDetails as any, '100'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return positions for all planets', async () => {
    const result = await service.getDivisionalChart('test-uuid', mockBirthDetails as any, 'navamsa');
    expect(result.positions).toBeDefined();
    expect(Array.isArray(result.positions)).toBe(true);
    expect(result.positions.length).toBeGreaterThan(0);
    // Each position should have planet, sign, degree
    for (const pos of result.positions) {
      expect(pos).toHaveProperty('planet');
      expect(pos).toHaveProperty('sign');
      expect(pos).toHaveProperty('degree');
    }
  });
});
