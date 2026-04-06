import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TarotService } from '../src/modules/tarot/tarot.service';
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

describe('TarotService', () => {
  let service: TarotService;
  let prisma: any;
  let userService: any;

  beforeEach(async () => {
    prisma = {
      ...mockPrismaService(),
      tarotReading: {
        create: jest.fn().mockResolvedValue({ id: 'tarot-1', createdAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    userService = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TarotService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    service = module.get<TarotService>(TarotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should draw a single card (spread=single)', async () => {
    const result = await service.drawCards('test-uuid', { spread: 'single' as any });
    expect(result.cards).toHaveLength(1);
    expect(result.spread).toBe('single');
  });

  it('should draw three cards for three-card spread', async () => {
    const result = await service.drawCards('test-uuid', { spread: 'three-card' as any });
    expect(result.cards).toHaveLength(3);
    expect(result.spread).toBe('three-card');
  });

  it('should draw 10 cards for celtic-cross spread', async () => {
    const result = await service.drawCards('test-uuid', { spread: 'celtic-cross' as any });
    expect(result.cards).toHaveLength(10);
    expect(result.spread).toBe('celtic-cross');
  });

  it('should deduct 1 credit for single spread', async () => {
    await service.drawCards('test-uuid', { spread: 'single' as any });
    expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 1, expect.any(String));
  });

  it('should deduct 2 credits for three-card spread', async () => {
    await service.drawCards('test-uuid', { spread: 'three-card' as any });
    expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 2, expect.any(String));
  });

  it('should deduct 3 credits for celtic-cross spread', async () => {
    await service.drawCards('test-uuid', { spread: 'celtic-cross' as any });
    expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 3, expect.any(String));
  });

  it('should throw on insufficient credits', async () => {
    userService.deductCredits.mockResolvedValue(false);
    await expect(service.drawCards('test-uuid', { spread: 'single' as any })).rejects.toThrow(BadRequestException);
  });

  it('should throw on invalid spread type', async () => {
    await expect(service.drawCards('test-uuid', { spread: 'invalid' as any })).rejects.toThrow(BadRequestException);
  });

  it('should return reading history', async () => {
    const result = await service.getHistory('test-uuid');
    expect(Array.isArray(result)).toBe(true);
    expect(prisma.tarotReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'test-uuid' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
