import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VastuService } from '../src/modules/vastu/vastu.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import {
  mockPrismaService,
  mockConfigService,
  mockUserService,
  mockOpenAIService,
  mockKnowledgeService,
} from './helpers/mocks';

describe('VastuService', () => {
  let service: VastuService;
  let userService: any;

  beforeEach(async () => {
    userService = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VastuService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    service = module.get<VastuService>(VastuService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should analyze a house with NE entrance (score >= 90)', async () => {
    const result = await service.analyze('test-uuid', {
      propertyType: 'house',
      entranceDirection: 'NE',
    } as any);

    expect(result.entrance.score).toBeGreaterThanOrEqual(90);
    expect(result.entrance.direction).toBe('NE');
  });

  it('should analyze with SW entrance (score <= 40)', async () => {
    const result = await service.analyze('test-uuid', {
      propertyType: 'house',
      entranceDirection: 'SW',
    } as any);

    expect(result.entrance.score).toBeLessThanOrEqual(40);
  });

  it('should deduct 2 credits', async () => {
    await service.analyze('test-uuid', {
      propertyType: 'house',
      entranceDirection: 'NE',
    } as any);

    expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 2, expect.any(String));
  });

  it('should throw on insufficient credits', async () => {
    userService.deductCredits.mockResolvedValue(false);

    await expect(
      service.analyze('test-uuid', {
        propertyType: 'house',
        entranceDirection: 'NE',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return 8 directions in analysis', async () => {
    const result = await service.analyze('test-uuid', {
      propertyType: 'house',
      entranceDirection: 'E',
    } as any);

    expect(result.directions).toHaveLength(8);
    const dirNames = result.directions.map((d: any) => d.direction);
    expect(dirNames).toContain('N');
    expect(dirNames).toContain('NE');
    expect(dirNames).toContain('E');
    expect(dirNames).toContain('SE');
    expect(dirNames).toContain('S');
    expect(dirNames).toContain('SW');
    expect(dirNames).toContain('W');
    expect(dirNames).toContain('NW');
  });

  it('should return property-specific tips', async () => {
    const result = await service.analyze('test-uuid', {
      propertyType: 'house',
      entranceDirection: 'N',
    } as any);

    expect(result.propertyTips).toBeDefined();
    expect(Array.isArray(result.propertyTips)).toBe(true);
    expect(result.propertyTips.length).toBeGreaterThan(0);
    // House-specific tip
    expect(result.propertyTips.some((t: string) => t.includes('Puja room'))).toBe(true);
  });

  it('should include remedies in fallback insights', async () => {
    const result = await service.analyze('test-uuid', {
      propertyType: 'house',
      entranceDirection: 'SW',
      concern: 'financial problems',
    } as any);

    expect(result.insights).toBeDefined();
    expect(result.insights.remedies).toBeDefined();
    expect(Array.isArray(result.insights.remedies)).toBe(true);
    expect(result.insights.remedies.length).toBeGreaterThan(0);
  });
});
