import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '../src/modules/chat/chat.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { LlmService } from '../src/llm/llm.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { ModerationService } from '../src/safety/moderation.service';
import { MemoryService } from '../src/modules/memory/memory.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { mockKnowledgeService, mockOpenAIService, mockConfigService, mockUserService, mockUser, mockMemoryService } from './helpers/mocks';
import { firstValueFrom, toArray } from 'rxjs';

// Non-subscriber by default so the existing credit-deduction assertions
// hold; subscribers bypass deduction.
const mockFeatureAccess = () => ({
  isActiveSubscriber: jest.fn().mockResolvedValue(false),
  paidFeaturesFree: jest.fn().mockResolvedValue(false),
  resolveUnlock: jest.fn(),
  consumeEntitlement: jest.fn(),
});

describe('ChatService — SSE Streaming (Item 3)', () => {
  let service: ChatService;
  let prisma: any;
  let llmService: any;
  let userService: any;

  const mockSession = {
    id: 'session-1',
    userId: 'test-uuid',
    title: 'Test',
    category: 'general',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  };

  beforeEach(async () => {
    prisma = {
      chatSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockSession),
        findMany: jest.fn().mockResolvedValue([]),
      },
      chatMessage: {
        create: jest.fn().mockResolvedValue({ id: 'msg-1', sessionId: 'session-1', role: 'ASSISTANT', content: 'test', createdAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    llmService = {
      chatCompletionStream: jest.fn().mockResolvedValue(
        (async function* () {
          yield 'Based on ';
          yield 'your chart, ';
          yield 'career growth is indicated.';
        })(),
      ),
      chatCompletion: jest.fn().mockResolvedValue({ content: 'Full response' }),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
    };

    userService = mockUserService();

    const openaiService = mockOpenAIService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: openaiService },
        { provide: LlmService, useValue: llmService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: mockMemoryService() },
        { provide: FeatureAccessService, useValue: mockFeatureAccess() },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('sendMessageStream', () => {
    it('should return an Observable that emits SSE events', (done) => {
      const observable = service.sendMessageStream('test-uuid', {
        message: 'Tell me about my career',
        category: 'career',
      });

      expect(observable).toBeDefined();
      expect(observable.subscribe).toBeDefined();

      const events: any[] = [];
      observable.subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(events.length).toBeGreaterThan(0);
          done();
        },
        error: done.fail,
      });
    });

    it('should deduct credits before streaming', (done) => {
      const observable = service.sendMessageStream('test-uuid', {
        message: 'Hello',
      });

      observable.subscribe({
        complete: () => {
          expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 1, expect.any(String));
          done();
        },
        error: done.fail,
      });
    });

    it('should save assistant message on completion', (done) => {
      const observable = service.sendMessageStream('test-uuid', {
        message: 'Career advice',
        category: 'career',
      });

      observable.subscribe({
        complete: () => {
          // The full concatenated content should be saved
          expect(prisma.chatMessage.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                role: 'ASSISTANT',
                content: expect.any(String),
              }),
            }),
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should emit done event with messageId and sessionId', (done) => {
      const observable = service.sendMessageStream('test-uuid', {
        message: 'Hello',
      });

      const events: any[] = [];
      observable.subscribe({
        next: (event) => events.push(event),
        complete: () => {
          const lastEvent = events[events.length - 1];
          const data = JSON.parse(lastEvent.data);
          expect(data.messageId).toBeDefined();
          expect(data.sessionId).toBeDefined();
          done();
        },
        error: done.fail,
      });
    });

    it('should emit error and refund credits when stream fails', (done) => {
      llmService.chatCompletionStream.mockRejectedValue(new Error('Provider timeout'));

      const observable = service.sendMessageStream('test-uuid', {
        message: 'Hello',
      });

      const events: any[] = [];
      observable.subscribe({
        next: (event) => events.push(event),
        complete: () => {
          const errorEvent = events.find((e) => {
            const data = JSON.parse(e.data);
            return data.refunded !== undefined;
          });
          expect(errorEvent).toBeDefined();
          expect(userService.addCredits).toHaveBeenCalled();
          done();
        },
        error: done.fail,
      });
    });

    it('should handle insufficient credits gracefully', (done) => {
      userService.deductCredits.mockResolvedValue(false);

      const observable = service.sendMessageStream('test-uuid', {
        message: 'Hello',
      });

      const events: any[] = [];
      observable.subscribe({
        next: (event) => events.push(event),
        complete: () => {
          const errorEvent = events.find((e) => {
            const data = JSON.parse(e.data);
            return data.message && data.message.includes('credits');
          });
          expect(errorEvent).toBeDefined();
          done();
        },
        error: done.fail,
      });
    });

    it('should fall back to non-streaming when stream is null', (done) => {
      llmService.chatCompletionStream.mockResolvedValue(null);

      const observable = service.sendMessageStream('test-uuid', {
        message: 'Hello',
      });

      const events: any[] = [];
      observable.subscribe({
        next: (event) => events.push(event),
        complete: () => {
          // Should still emit events (fallback KB response)
          expect(events.length).toBeGreaterThan(0);
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('sendMessage — existing sync path preserved', () => {
    it('should still work synchronously', async () => {
      const openaiService = mockOpenAIService();
      openaiService.chatCompletion.mockResolvedValue('Career is looking good.');

      prisma.chatMessage.create
        .mockResolvedValueOnce({ id: 'user-msg', role: 'USER', content: 'Career?' })
        .mockResolvedValueOnce({ id: 'ai-msg', sessionId: 'session-1', role: 'ASSISTANT', content: 'Career is looking good.', createdAt: new Date() });

      // Re-create module with AI-returning openaiService
      const module = await Test.createTestingModule({
        providers: [
          ChatService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: UserService, useValue: userService },
          { provide: OpenAIService, useValue: openaiService },
          { provide: LlmService, useValue: llmService },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: mockMemoryService() },
        { provide: FeatureAccessService, useValue: mockFeatureAccess() },
        ],
      }).compile();

      const svc = module.get<ChatService>(ChatService);
      const result = await svc.sendMessage('test-uuid', { message: 'Career?', category: 'career' });

      expect(result.reply).toBeDefined();
      expect(result.session).toBeDefined();
    });
  });
});
