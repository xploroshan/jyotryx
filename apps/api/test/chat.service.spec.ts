import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { ChatService } from '../src/modules/chat/chat.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { ModerationService } from '../src/safety/moderation.service';
import { MemoryService } from '../src/modules/memory/memory.service';
import { LlmService } from '../src/llm/llm.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { mockKnowledgeService, mockLlmService, mockMemoryService } from './helpers/mocks';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let userService: any;
  let openaiService: any;

  const mockUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    credits: 10,
    role: 'USER',
  };

  const mockSession = {
    id: 'session-1',
    userId: 'test-uuid',
    title: 'Career Consultation',
    category: 'career',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  };

  const mockMessage = {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'assistant',
    content: 'Based on your chart, career growth is indicated.',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      chatSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      chatMessage: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(mockUser),
      getCredits: jest.fn().mockResolvedValue({ available: 10, used: 5, total: 15 }),
    };

    openaiService = {
      chatCompletion: jest.fn().mockResolvedValue('Based on your chart, career growth is indicated.'),
      getClient: jest.fn().mockReturnValue({}),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'openai.model': 'gpt-4o',
                'credits.chatCost': 1,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: openaiService },
        { provide: LlmService, useValue: mockLlmService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: mockMemoryService() },
        {
          provide: FeatureAccessService,
          useValue: {
            isActiveSubscriber: jest.fn().mockResolvedValue(false),
            paidFeaturesFree: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('sendMessage', () => {
    it('should deduct credits when sending a message', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      prisma.chatSession.create.mockResolvedValue(mockSession);
      prisma.chatMessage.create
        .mockResolvedValueOnce({ id: 'msg-user', role: 'user', content: 'Tell me about my career' })
        .mockResolvedValueOnce(mockMessage);
      prisma.chatMessage.findMany.mockResolvedValue([]);

      await service.sendMessage('test-uuid', {
        message: 'Tell me about my career',
        category: 'career',
      });

      expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 1, expect.any(String));
    });

    it('should create a new session when none exists', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      prisma.chatSession.create.mockResolvedValue(mockSession);
      prisma.chatMessage.create
        .mockResolvedValueOnce({ id: 'msg-user', role: 'user', content: 'Hello' })
        .mockResolvedValueOnce(mockMessage);
      prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.sendMessage('test-uuid', {
        message: 'Hello',
        category: 'general',
      });

      expect(prisma.chatSession.create).toHaveBeenCalled();
      expect(result.reply).toBeDefined();
    });

    it('should reuse existing session when sessionId provided', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);
      prisma.chatSession.update.mockResolvedValue(mockSession);
      prisma.chatMessage.create
        .mockResolvedValueOnce({ id: 'msg-user', role: 'user', content: 'Follow up' })
        .mockResolvedValueOnce(mockMessage);
      prisma.chatMessage.findMany.mockResolvedValue([]);

      await service.sendMessage('test-uuid', {
        message: 'Follow up',
        sessionId: 'session-1',
      });

      expect(prisma.chatSession.create).not.toHaveBeenCalled();
    });

    it('should return fallback response when OpenAI fails', async () => {
      openaiService.chatCompletion.mockResolvedValue(null);
      prisma.chatSession.findFirst.mockResolvedValue(null);
      prisma.chatSession.create.mockResolvedValue(mockSession);
      prisma.chatMessage.create.mockResolvedValue(mockMessage);
      prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.sendMessage('test-uuid', {
        message: 'Tell me something',
        category: 'general',
      });

      expect(result.reply).toBeDefined();
      expect(result.reply.content).toBeTruthy();
    });
  });

  describe('getSessions', () => {
    it('should return user sessions ordered by updated date', async () => {
      const sessions = [
        { ...mockSession, id: 'session-2', updatedAt: new Date() },
        { ...mockSession, id: 'session-1', updatedAt: new Date(Date.now() - 86400000) },
      ];
      prisma.chatSession.findMany.mockResolvedValue(sessions);

      const result = await service.getSessions('test-uuid');

      expect(result.length).toBe(2);
      expect(prisma.chatSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'test-uuid' },
        }),
      );
    });

    it('should return empty array for user with no sessions', async () => {
      prisma.chatSession.findMany.mockResolvedValue([]);

      const result = await service.getSessions('test-uuid');

      expect(result).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should return session with messages', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(mockSession);
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: 'msg-1', sessionId: 'session-1', role: 'user', content: 'Hello', createdAt: new Date() },
        { id: 'msg-2', sessionId: 'session-1', role: 'assistant', content: 'Namaste!', createdAt: new Date() },
      ]);

      const result = await service.getSession('test-uuid', 'session-1');

      expect(result.id).toBe('session-1');
      expect(result.messages.length).toBe(2);
    });

    it('should throw BadRequestException for non-existent session', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getSession('test-uuid', 'non-existent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not return sessions from other users', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getSession('other-user', 'session-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'other-user' }),
        }),
      );
    });
  });
});
