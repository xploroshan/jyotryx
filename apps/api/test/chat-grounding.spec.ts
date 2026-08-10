/**
 * Regression tests for the "Chat with Astrologer" ultra-review.
 *
 * The reported bug: asked "when will I find a job", chat answered "mid 2024" —
 * a window already in the past. The system prompt contained no current date and
 * no computed chart, so every timing answer was invented from the model's
 * training distribution. These tests pin the fix and each adjacent defect the
 * review surfaced, so none of them can silently return.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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
import { mockKnowledgeService, mockLlmService, mockMemoryService } from './helpers/mocks';
import {
  assessProfile,
  buildChartBlock,
  buildMissingDataBlock,
  buildTemporalBlock,
  findRunningDasha,
  CRISIS_RESPONSE,
} from '../src/modules/chat/chat-grounding';
import { probeTokens } from '../src/knowledge/keywords.util';

// ---------------------------------------------------------------------------
// Pure grounding helpers
// ---------------------------------------------------------------------------

describe('chat grounding — temporal anchor (the reported bug)', () => {
  it('states today\'s date explicitly', () => {
    const block = buildTemporalBlock(new Date('2026-08-10T09:00:00Z'));
    expect(block).toContain('2026-08-10');
    expect(block).toContain('year 2026');
  });

  it('forbids naming a past window as if it were future', () => {
    // Knowing the date is not enough on its own — without this clause the
    // model still repeats a memorised-sounding year ("mid 2024").
    const block = buildTemporalBlock(new Date('2026-08-10T09:00:00Z'));
    expect(block.toLowerCase()).toContain('already passed');
    expect(block).toMatch(/on or after 2026-08-10/);
  });

  it('uses UTC, so the anchor does not drift with server timezone', () => {
    expect(buildTemporalBlock(new Date('2026-01-01T00:30:00Z'))).toContain('2026-01-01');
  });
});

describe('chat grounding — running dasha resolution', () => {
  const dashas = [
    {
      planet: 'Saturn',
      startDate: '2020-03-01',
      endDate: '2039-03-01',
      subPeriods: [
        { planet: 'Saturn', startDate: '2020-03-01', endDate: '2023-03-01' },
        {
          planet: 'Mercury',
          startDate: '2023-03-01',
          endDate: '2025-11-10',
          subPeriods: [{ planet: 'Ketu', startDate: '2025-01-01', endDate: '2025-11-10' }],
        },
        { planet: 'Ketu', startDate: '2025-11-10', endDate: '2027-01-01' },
      ],
    },
    { planet: 'Mercury', startDate: '2039-03-01', endDate: '2056-03-01' },
  ];

  it('picks the maha and antar period containing today', () => {
    const r = findRunningDasha(dashas, new Date('2026-08-10T00:00:00Z'));
    expect(r.maha?.planet).toBe('Saturn');
    expect(r.antar?.planet).toBe('Ketu');
  });

  it('resolves a changeover day to exactly one period (start inclusive, end exclusive)', () => {
    const r = findRunningDasha(dashas, new Date('2025-11-10T00:00:00Z'));
    expect(r.antar?.planet).toBe('Ketu');
    expect(r.antar?.startDate).toBe('2025-11-10');
  });

  it('descends to pratyantardasha when one contains today', () => {
    const r = findRunningDasha(dashas, new Date('2025-06-01T00:00:00Z'));
    expect(r.antar?.planet).toBe('Mercury');
    expect(r.pratyantar?.planet).toBe('Ketu');
  });

  it('returns nothing rather than guessing when the timeline does not cover today', () => {
    expect(findRunningDasha(dashas, new Date('1990-01-01T00:00:00Z'))).toEqual({});
    expect(findRunningDasha(undefined, new Date())).toEqual({});
  });
});

describe('chat grounding — chart block', () => {
  const chart = {
    ascendant: 'Aries',
    moonSign: 'Scorpio',
    nakshatra: 'Anuradha',
    planetaryPositions: [
      { planet: 'Sun', sign: 'Leo', house: 5, status: 'Own Sign' },
      { planet: 'Saturn', sign: 'Pisces', house: 12, isRetrograde: true },
    ],
    yogas: [{ name: 'Gajakesari Yoga' }],
    dashas: [
      {
        planet: 'Saturn',
        startDate: '2020-03-01',
        endDate: '2039-03-01',
        subPeriods: [{ planet: 'Mercury', startDate: '2026-01-01', endDate: '2028-08-02' }],
      },
      { planet: 'Mercury', startDate: '2039-03-01', endDate: '2056-03-01' },
    ],
  };
  const now = new Date('2026-08-10T00:00:00Z');

  it('carries REAL dasha dates the model can cite instead of inventing a year', () => {
    const block = buildChartBlock(chart, now);
    expect(block).toContain('Saturn (2020-03-01 to 2039-03-01)');
    expect(block).toContain('Mercury (2026-01-01 to 2028-08-02)');
  });

  it('names the next mahadasha changeover — the anchor timing questions want', () => {
    expect(buildChartBlock(chart, now)).toContain('Mercury from 2039-03-01');
  });

  it('carries placements with dignity and retrogression', () => {
    const block = buildChartBlock(chart, now);
    expect(block).toContain('Sun: Leo, house 5 (Own Sign)');
    expect(block).toContain('Saturn: Pisces, house 12 (retrograde)');
    expect(block).toContain('Ascendant (Lagna): Aries');
  });

  it('tells the model not to invent placements outside the block', () => {
    expect(buildChartBlock(chart, now)).toContain('Do not invent placements');
  });

  it('returns empty (not a bare header) when there is no usable chart', () => {
    expect(buildChartBlock(null, now)).toBe('');
    expect(buildChartBlock({}, now)).toBe('');
  });
});

describe('chat grounding — honesty about missing data', () => {
  it('detects each missing birth field', () => {
    expect(assessProfile({ dateOfBirth: new Date() }).missing).toEqual([
      'time of birth',
      'place of birth',
    ]);
    expect(assessProfile(null).missing).toEqual([
      'date of birth',
      'time of birth',
      'place of birth',
    ]);
    expect(
      assessProfile({ dateOfBirth: new Date(), timeOfBirth: '10:30', placeOfBirth: { name: 'Pune' } })
        .complete,
    ).toBe(true);
  });

  it('accepts a bare-string placeOfBirth as well as the {name} object', () => {
    const p = assessProfile({ dateOfBirth: new Date(), timeOfBirth: '10:30', placeOfBirth: 'Pune' });
    expect(p.complete).toBe(true);
  });

  it('EXPLICITLY forbids stating an ascendant when time/place are missing', () => {
    // The old prompt simply omitted the profile block and still commanded
    // "use the user's actual birth details for accurate chart reading", so an
    // empty profile produced a confidently fabricated chart.
    const block = buildMissingDataBlock(assessProfile({ dateOfBirth: new Date() }), false);
    expect(block).toContain('MISSING BIRTH DATA: time of birth, place of birth');
    expect(block).toContain('do not give a dated prediction');
    expect(block.toLowerCase()).toContain('ascendant');
  });

  it('flags a missing CHART even when the profile is complete', () => {
    // Complete profile but no kundli ever generated: there is still no
    // computed chart in the prompt, and the model must not pretend otherwise.
    const complete = assessProfile({
      dateOfBirth: new Date(),
      timeOfBirth: '10:30',
      placeOfBirth: { name: 'Pune' },
    });
    expect(buildMissingDataBlock(complete, false)).toContain('No computed birth chart');
    expect(buildMissingDataBlock(complete, true)).toBe('');
  });
});

describe('KB retrieval — stop-word probe', () => {
  it('drops interrogative openers and keeps the content words', () => {
    // The last-resort `text: { contains: … }` tier probed token ZERO, so
    // "when will I find a job" substring-searched the corpus for "when" and
    // returned arbitrary chunks as authoritative grounding.
    expect(probeTokens('when will I find a job')).toEqual(['find', 'job']);
    expect(probeTokens('what is my rising sign')).toEqual(['rising', 'sign']);
    expect(probeTokens('how will my career go')).toEqual(['career']);
  });

  it('is empty when nothing meaningful survives, so the tier is skipped', () => {
    expect(probeTokens('when will it be')).toEqual([]);
    expect(probeTokens('')).toEqual([]);
  });

  it('keeps working for non-Latin scripts', () => {
    expect(probeTokens('मंगल दोष')).toEqual(['मंगल', 'दोष']);
  });

  it('is bounded so a long question cannot build a huge OR predicate', () => {
    const long = Array.from({ length: 200 }, (_, i) => `token${i}`).join(' ');
    expect(probeTokens(long)).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// Service-level behaviour
// ---------------------------------------------------------------------------

describe('ChatService — grounded prompts, safety and billing', () => {
  let service: ChatService;
  let prisma: any;
  let openaiService: any;
  let userService: any;
  let featureAccess: any;
  let moderation: any;
  let gochar: any;

  const session = {
    id: 'session-1',
    userId: 'u1',
    title: 'Career',
    category: 'career',
    astrologerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const assistantMsg = {
    id: 'msg-a',
    sessionId: 'session-1',
    role: 'assistant',
    content: 'reply',
    createdAt: new Date(),
  };

  /** The system prompt actually sent to the model on the last call. */
  const systemPrompt = () => openaiService.chatCompletion.mock.calls.at(-1)[0].messages[0].content;

  beforeEach(async () => {
    prisma = {
      chatSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(session),
      },
      chatMessage: {
        // Echo the content back, so a test can assert what was actually
        // persisted rather than a fixed stub.
        create: jest.fn(async ({ data }: any) => ({ ...assistantMsg, ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Asha',
          dateOfBirth: new Date('1994-08-02T00:00:00Z'),
          timeOfBirth: '10:30',
          placeOfBirth: { name: 'Pune', lat: 18.52, lng: 73.85 },
          gender: 'female',
          astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE', 'HELLENISTIC', 'HORARY', 'MEDICAL'],
          primaryTradition: null,
        }),
      },
      kundliChart: {
        findFirst: jest.fn().mockResolvedValue({
          chartData: {
            ascendant: 'Aries',
            planetaryPositions: [{ planet: 'Sun', sign: 'Leo', house: 5 }],
            dashas: [
              {
                planet: 'Saturn',
                startDate: '2020-03-01',
                endDate: '2039-03-01',
                subPeriods: [{ planet: 'Mercury', startDate: '2026-01-01', endDate: '2028-08-02' }],
              },
            ],
          },
        }),
      },
    };

    userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      addCredits: jest.fn().mockResolvedValue(undefined),
    };

    openaiService = {
      chatCompletion: jest.fn().mockResolvedValue('A grounded reply.'),
      getClient: jest.fn().mockReturnValue({}),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
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

    moderation = { checkAndRecord: jest.fn().mockResolvedValue(null) };
    gochar = { computePersonalization: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: any) => d) } },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: openaiService },
        { provide: LlmService, useValue: mockLlmService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: moderation },
        { provide: MemoryService, useValue: mockMemoryService() },
        { provide: FeatureAccessService, useValue: featureAccess },
        { provide: GocharService, useValue: gochar },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  const ask = (message = 'when will I find a job', category = 'career') =>
    service.sendMessage('u1', { message, category } as any);

  describe('grounding reaches the model', () => {
    it('injects today\'s date into the system prompt', async () => {
      await ask();
      expect(systemPrompt()).toContain(new Date().toISOString().split('T')[0]);
      expect(systemPrompt()).toContain("TODAY'S DATE");
    });

    it('injects the persisted chart, including real dasha windows', async () => {
      await ask();
      expect(prisma.kundliChart.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, orderBy: { createdAt: 'desc' } }),
      );
      expect(systemPrompt()).toContain('COMPUTED BIRTH CHART');
      expect(systemPrompt()).toContain('2028-08-02');
    });

    it('READS the stored chart — never recomputes it (generateKundli charges credits)', async () => {
      await ask();
      // A chat message must not silently bill a kundli generation.
      expect(userService.deductCredits).toHaveBeenCalledTimes(1);
      expect(userService.deductCredits).toHaveBeenCalledWith('u1', expect.any(Number), 'Chat message');
    });

    it('injects live transits when the ephemeris can produce them', async () => {
      gochar.computePersonalization.mockResolvedValue({
        moonSign: 'Scorpio',
        natalNakshatra: 'Anuradha',
        transitAlert: 'Sade Sati second phase',
        focusGraha: 'Saturn',
      });
      await ask();
      expect(systemPrompt()).toContain('LIVE TRANSITS');
      expect(systemPrompt()).toContain('Sade Sati second phase');
    });

    it('degrades safely when the ephemeris throws — the turn still completes', async () => {
      gochar.computePersonalization.mockRejectedValue(new Error('swisseph down'));
      const r = await ask();
      expect(r.reply.content).toBeTruthy();
      expect(systemPrompt()).toContain("TODAY'S DATE");
    });

    it('says so explicitly when the user has no chart', async () => {
      prisma.kundliChart.findFirst.mockResolvedValue(null);
      await ask();
      expect(systemPrompt()).toContain('No computed birth chart');
    });
  });

  describe('persona and traditions', () => {
    it('never leaks a raw DB enum name into the prompt', async () => {
      // The DEFAULT profile carries six traditions and the old mapper handled
      // only three, so "HELLENISTIC, HORARY, MEDICAL" went into the prompt
      // verbatim for most users.
      await ask();
      const p = systemPrompt();
      expect(p).not.toContain('HELLENISTIC');
      expect(p).not.toContain('MEDICAL');
      expect(p).not.toContain('HORARY');
    });

    it('caps the descriptor at two traditions', async () => {
      await ask();
      // Six-way comparison inside a 2-3 paragraph budget produced a smoothie.
      expect(systemPrompt()).toContain('Vedic and Western (tropical) astrology traditions');
    });

    it('honours primaryTradition when the user has set one', async () => {
      prisma.user.findUnique.mockResolvedValue({
        dateOfBirth: new Date('1994-08-02T00:00:00Z'),
        timeOfBirth: '10:30',
        placeOfBirth: { name: 'Pune' },
        astrologyTraditions: ['VEDIC', 'WESTERN'],
        primaryTradition: 'WESTERN',
      });
      await ask();
      expect(systemPrompt()).toContain('Western (tropical) and Vedic');
    });
  });

  describe('harm boundaries', () => {
    it('forbids death, medical diagnosis and guaranteed financial claims', async () => {
      // palmistry.service.ts has carried this clause since launch; chat — the
      // most open-ended surface in the product — carried nothing.
      const p = (await ask(), systemPrompt());
      expect(p).toContain('Never predict death');
      expect(p).toContain('Never give a medical diagnosis');
      expect(p.toLowerCase()).toContain('never present financial, legal or medical instructions as certainties');
    });

    it('answers a self-harm disclosure with crisis resources, never a policy rejection', async () => {
      moderation.checkAndRecord.mockResolvedValue({
        flagged: true,
        categories: ['self-harm/intent'],
      });
      const r = await ask('I do not want to be alive any more');

      expect(r.reply.content).toBe(CRISIS_RESPONSE);
      expect(r.reply.content).toContain('14416');
      expect(r.reply.content).toContain('988');
      // Never sent to the astrology persona.
      expect(openaiService.chatCompletion).not.toHaveBeenCalled();
      // Never charged.
      expect(userService.addCredits).toHaveBeenCalledWith('u1', 1, 'PURCHASE', expect.stringContaining('Refund'));
    });

    it('still hard-blocks the non-crisis categories', async () => {
      moderation.checkAndRecord.mockResolvedValue({ flagged: true, categories: ['sexual/minors'] });
      await expect(ask('blocked content')).rejects.toThrow(/content policy/);
      expect(openaiService.chatCompletion).not.toHaveBeenCalled();
    });

    it('does not block on a soft flag', async () => {
      moderation.checkAndRecord.mockResolvedValue({ flagged: true, categories: ['harassment'] });
      const r = await ask('you are useless');
      expect(r.reply.content).toBeTruthy();
    });
  });

  describe('degraded output is never a fabricated reading', () => {
    it('the outage fallback makes no chart claims', async () => {
      openaiService.chatCompletion.mockResolvedValue(null);
      const r = await ask('will I be rich', 'wealth');
      const text = r.reply.content ?? '';
      // The old wealth fallback asserted "the 2nd and 11th houses in your chart
      // suggest promising financial opportunities" to users with no chart.
      expect(text).not.toMatch(/your chart/i);
      expect(text).not.toMatch(/houses in your/i);
      expect(text).not.toMatch(/Dashamsha/i);
    });

    it('and refunds rather than charging for it', async () => {
      openaiService.chatCompletion.mockResolvedValue(null);
      await ask();
      expect(userService.addCredits).toHaveBeenCalledWith(
        'u1',
        1,
        'PURCHASE',
        expect.stringContaining('astrologer unavailable'),
      );
    });

    it('releases the metered unit too, not just credits', async () => {
      featureAccess.creditsEnabled.mockResolvedValue(false);
      openaiService.chatCompletion.mockResolvedValue(null);
      await ask();
      expect(featureAccess.decrementUsage).toHaveBeenCalledWith('u1', 'chat', 'LIFETIME');
    });
  });

  describe('billing integrity', () => {
    it('refunds when the setup writes fail AFTER the charge', async () => {
      // These writes used to sit outside every refund handler while the client
      // was told `refunded: true`.
      prisma.chatMessage.create.mockRejectedValueOnce(new Error('db down'));
      await expect(ask()).rejects.toThrow('db down');
      expect(userService.addCredits).toHaveBeenCalledWith(
        'u1',
        1,
        'PURCHASE',
        expect.stringContaining('chat setup failed'),
      );
    });

    it('claims the metered unit atomically instead of check-then-increment', async () => {
      featureAccess.creditsEnabled.mockResolvedValue(false);
      await ask();
      expect(featureAccess.tryConsumeUsage).toHaveBeenCalledWith('u1', 'chat');
      expect(featureAccess.incrementUsage).not.toHaveBeenCalled();
    });
  });

  describe('session hygiene', () => {
    it('touches updatedAt so an active old thread rises in the list', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(session);
      await service.sendMessage('u1', { message: 'follow up', sessionId: 'session-1' } as any);
      expect(prisma.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: { updatedAt: expect.any(Date) },
        }),
      );
    });

    it('applies a mid-conversation category switch instead of ignoring it', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(session); // category: 'career'
      prisma.chatSession.update.mockResolvedValue({ ...session, category: 'relationship' });
      await service.sendMessage('u1', {
        message: 'is he the right partner',
        sessionId: 'session-1',
        category: 'relationship',
      } as any);
      expect(prisma.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { category: 'relationship' } }),
      );
      expect(systemPrompt()).toContain('relationship compatibility');
    });

    it('fetches only the history it actually replays', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(session);
      await service.sendMessage('u1', { message: 'hi', sessionId: 'session-1' } as any);
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
