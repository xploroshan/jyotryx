import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { StorageService } from '../src/storage/storage.service';
import { mockKnowledgeService, mockStorageService } from './helpers/mocks';

describe('PalmistryService', () => {
  let service: PalmistryService;
  let prisma: any;
  let userService: any;
  let openaiService: any;

  const mockUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    credits: 20,
    role: 'USER',
  };

  beforeEach(async () => {
    prisma = {
      palmistryReading: {
        create: jest.fn().mockResolvedValue({
          id: 'palm-1',
          userId: 'test-uuid',
          createdAt: new Date(),
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    openaiService = {
      chat: jest.fn().mockResolvedValue(null),
      chatCompletion: jest.fn().mockResolvedValue(null),
      chatWithImage: jest.fn().mockResolvedValue(null),
      getClient: jest.fn().mockReturnValue(null),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PalmistryService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'openai.model': 'gpt-4o',
                'credits.palmistryCost': 3,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: openaiService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: StorageService, useValue: mockStorageService() },
      ],
    }).compile();

    service = module.get<PalmistryService>(PalmistryService);
  });

  describe('analyzePalm', () => {
    it('should deduct credits for palm analysis', async () => {
      const imageBuffer = Buffer.from('fake-image-data');

      await service.analyzePalm('test-uuid', imageBuffer, 'image/jpeg');

      expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 3, expect.any(String));
    });

    it('should return fallback analysis when OpenAI fails', async () => {
      openaiService.chatWithImage.mockResolvedValue(null);
      openaiService.chat.mockResolvedValue(null);

      const result = await service.analyzePalm('test-uuid', Buffer.from('fake'), 'image/jpeg');

      expect(result).toBeDefined();
      expect(result.lines).toBeDefined();
      expect(result.mounts).toBeDefined();
    });

    it('should return analysis with all required sections', async () => {
      openaiService.chatWithImage.mockResolvedValue(null);
      openaiService.chat.mockResolvedValue(null);

      const result = await service.analyzePalm('test-uuid', Buffer.from('fake'), 'image/jpeg');

      // Check that key analysis fields exist
      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('mounts');
      expect(result).toHaveProperty('overallReading');
    });

    it('should save reading to database', async () => {
      const imageBuffer = Buffer.from('fake-image-data');

      await service.analyzePalm('test-uuid', imageBuffer, 'image/jpeg');

      expect(prisma.palmistryReading.create).toHaveBeenCalled();
    });

    it('should handle missing image gracefully', async () => {
      const result = await service.analyzePalm('test-uuid');

      expect(result).toBeDefined();
      expect(userService.deductCredits).toHaveBeenCalled();
    });
  });
});
