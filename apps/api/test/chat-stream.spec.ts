/**
 * Streaming-path regressions from the chat ultra-review.
 *
 * SSE is the path mobile uses, and it carried the worst of the billing and
 * data-integrity defects: a hardcoded `refunded: true` that refunded nothing,
 * a mid-stream failure that discarded everything the user had already watched
 * render, and a session id revealed only on success so every retry forked a
 * new conversation.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, toArray } from 'rxjs';
import { ChatService } from '../src/modules/chat/chat.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { ModerationService } from '../src/safety/moderation.service';
import { MemoryService } from '../src/modules/memory/memory.service';
import { LlmService } from '../src/llm/llm.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { GocharService } from '../src/modules/daily-briefing/gochar.service';
import { mockKnowledgeService, mockMemoryService } from './helpers/mocks';

describe('ChatService — streaming', () => {
  let service: ChatService;
  let prisma: any;
  let llm: any;
  let userService: any;
  let featureAccess: any;

  const session = {
    id: 'session-1',
    userId: 'u1',
    title: 'Career',
    category: 'career',
    astrologerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /** Collect every SSE payload the observable emits. */
  const collect = async (dto: any) => {
    const events = await firstValueFrom(service.sendMessageStream('u1', dto).pipe(toArray()));
    return events.map((e: any) => JSON.parse(e.data));
  };

  beforeEach(async () => {
    prisma = {
      chatSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(session),
      },
      chatMessage: {
        create: jest.fn(async ({ data }: any) => ({
          id: 'msg-1',
          sessionId: data.sessionId,
          role: data.role,
          content: data.content,
          createdAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Asha',
          dateOfBirth: new Date('1994-08-02T00:00:00Z'),
          timeOfBirth: '10:30',
          placeOfBirth: { name: 'Pune' },
          astrologyTraditions: ['VEDIC'],
          primaryTradition: null,
        }),
      },
      kundliChart: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      addCredits: jest.fn().mockResolvedValue(undefined),
    };

    llm = {
      chatCompletion: jest.fn(),
      chatCompletionStream: jest.fn(),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
      computeCost: jest.fn().mockReturnValue(0),
    };

    featureAccess = {
      isActiveSubscriber: jest.fn().mockResolvedValue(false),
      paidFeaturesFree: jest.fn().mockResolvedValue(false),
      creditsEnabled: jest.fn().mockResolvedValue(true),
      getCreditCost: jest.fn(async (_n: string, fb: number) => fb),
      checkUsage: jest.fn().mockResolvedValue({ allowed: true, periodKey: 'LIFETIME', isSubscriber: false }),
      tryConsumeUsage: jest.fn().mockResolvedValue({ allowed: true, periodKey: 'LIFETIME', isSubscriber: false }),
      incrementUsage: jest.fn().mockResolvedValue(undefined),
      decrementUsage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: any) => d) } },
        { provide: UserService, useValue: userService },
        {
          provide: OpenAIService,
          useValue: {
            chatCompletion: jest.fn().mockResolvedValue('reply'),
            getClient: jest.fn().mockReturnValue({}),
            getModel: jest.fn().mockReturnValue('gpt-4o'),
          },
        },
        { provide: LlmService, useValue: llm },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: mockMemoryService() },
        { provide: FeatureAccessService, useValue: featureAccess },
        { provide: GocharService, useValue: { computePersonalization: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  it('emits sessionId as the FIRST event, before any token', async () => {
    // It used to be emitted only on successful completion, so a first message
    // that timed out mid-stream left the client with sessionId still null —
    // every retry created another session with the same opening question.
    llm.chatCompletionStream.mockResolvedValue(
      (async function* () {
        yield 'Your ';
        yield 'Saturn dasha…';
      })(),
    );

    const events = await collect({ message: 'when will I find a job', category: 'career' });
    expect(events[0]).toEqual({ sessionId: 'session-1' });
  });

  it('persists what the user already saw when the stream dies mid-answer', async () => {
    llm.chatCompletionStream.mockResolvedValue(
      (async function* () {
        yield 'Your Saturn mahadasha runs to 2039. ';
        throw new Error('stream idle timeout');
      })(),
    );

    const events = await collect({ message: 'when will I find a job', category: 'career' });

    // The partial answer is saved, flagged as truncated — discarding it left a
    // user turn with NO assistant reply, so the next turn replayed a malformed
    // transcript and the model contradicted an answer still on screen.
    const saved = prisma.chatMessage.create.mock.calls.map((c: any) => c[0].data);
    const assistant = saved.find((d: any) => d.role === 'ASSISTANT');
    expect(assistant).toBeDefined();
    expect(assistant.content).toContain('Your Saturn mahadasha runs to 2039.');
    expect(assistant.content).toContain('cut short');
    expect(events.some((e) => e.truncated)).toBe(true);

    // And the credit really is returned.
    expect(userService.addCredits).toHaveBeenCalledWith('u1', 1, 'PURCHASE', expect.stringContaining('stream failed'));
    expect(events.at(-1).refunded).toBe(true);
  });

  it('does not persist or charge for an empty completion', async () => {
    llm.chatCompletionStream.mockResolvedValue((async function* () { /* no chunks */ })());

    const events = await collect({ message: 'hello', category: 'general' });

    const saved = prisma.chatMessage.create.mock.calls.map((c: any) => c[0].data);
    expect(saved.find((d: any) => d.role === 'ASSISTANT')).toBeUndefined();
    expect(userService.addCredits).toHaveBeenCalled();
    expect(events.at(-1).refunded).toBe(true);
  });

  it('refunds instead of metering when every provider is down', async () => {
    // The old code INCREMENTED the meter on this path: the user paid full
    // price for the canned "providers are down" text.
    featureAccess.creditsEnabled.mockResolvedValue(false);
    llm.chatCompletionStream.mockResolvedValue(null);

    const events = await collect({ message: 'hello', category: 'general' });

    expect(featureAccess.decrementUsage).toHaveBeenCalledWith('u1', 'chat', 'LIFETIME');
    expect(featureAccess.incrementUsage).not.toHaveBeenCalled();
    expect(events.some((e) => e.degraded)).toBe(true);
  });

  it('keeps the charge on a normal successful stream', async () => {
    llm.chatCompletionStream.mockResolvedValue(
      (async function* () {
        yield 'A grounded reply.';
      })(),
    );

    const events = await collect({ message: 'hello', category: 'general' });

    expect(userService.addCredits).not.toHaveBeenCalled();
    expect(featureAccess.decrementUsage).not.toHaveBeenCalled();
    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { updatedAt: expect.any(Date) } }),
    );
    expect(events.at(-1)).toMatchObject({ messageId: 'msg-1', sessionId: 'session-1' });
  });

  it('grounds the streamed prompt with today\'s date, exactly like the non-streaming path', async () => {
    // The two paths assembled the prompt separately and had already drifted;
    // they now share one builder.
    llm.chatCompletionStream.mockResolvedValue((async function* () { yield 'ok'; })());
    await collect({ message: 'when will I find a job', category: 'career' });

    const system = llm.chatCompletionStream.mock.calls[0][0].messages[0].content;
    expect(system).toContain("TODAY'S DATE");
    expect(system).toContain(new Date().toISOString().split('T')[0]);
    expect(system).toContain('Never predict death');
  });
});
