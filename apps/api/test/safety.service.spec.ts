/**
 * Phase 4 safety queue tests — state-machine + ModerationService
 * side-effect pinning. Keeps the invariants:
 *   1. Resolving a non-pending row throws.
 *   2. ModerationService writes a `flagged_messages` row ONLY when
 *      OpenAI flags the content. Safe inputs leave the table clean.
 *   3. Both services swallow OpenAI errors without propagating to
 *      the chat path (fire-and-forget contract).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SafetyService } from '../src/safety/safety.service';
import { ModerationService } from '../src/safety/moderation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaReadReplicaService } from '../src/prisma/prisma-read-replica.service';
import { OpenAIService } from '../src/openai/openai.service';

function makePrisma() {
  return {
    flaggedMessage: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'flag-1' }),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    chatMessage: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('SafetyService.resolve state machine', () => {
  let service: SafetyService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaReadReplicaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get<SafetyService>(SafetyService);
  });

  it('rejects resolve on a missing row', async () => {
    prisma.flaggedMessage.findUnique.mockResolvedValue(null);
    await expect(service.resolve('missing', 'hide', 'admin')).rejects.toThrow(NotFoundException);
  });

  it('rejects re-resolving an already-actioned row', async () => {
    prisma.flaggedMessage.findUnique.mockResolvedValue({
      id: 'f-1',
      status: 'hidden',
    });
    await expect(service.resolve('f-1', 'approve', 'admin')).rejects.toThrow(BadRequestException);
  });

  it('maps the resolve action to the next status', async () => {
    prisma.flaggedMessage.findUnique
      .mockResolvedValueOnce({ id: 'f-1', status: 'pending' })
      .mockResolvedValueOnce({
        id: 'f-1', status: 'hidden', messageId: 'm-1', userId: 'u-1',
        categories: [], scores: {}, reviewedBy: 'admin', reviewedAt: new Date(), createdAt: new Date(),
      });

    await service.resolve('f-1', 'hide', 'admin-1');

    expect(prisma.flaggedMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f-1' },
        data: expect.objectContaining({
          status: 'hidden',
          reviewedBy: 'admin-1',
        }),
      }),
    );
  });
});

describe('ModerationService.checkAndRecord', () => {
  let service: ModerationService;
  let prisma: ReturnType<typeof makePrisma>;
  let openaiClient: any;

  beforeEach(async () => {
    prisma = makePrisma();
    openaiClient = { moderations: { create: jest.fn() } };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: OpenAIService,
          useValue: { getClient: jest.fn().mockReturnValue(openaiClient) },
        },
      ],
    }).compile();
    service = moduleRef.get<ModerationService>(ModerationService);
  });

  it('inserts a flagged_messages row on a positive hit', async () => {
    openaiClient.moderations.create.mockResolvedValue({
      results: [{
        flagged: true,
        categories: { hate: true, harassment: false },
        category_scores: { hate: 0.92, harassment: 0.12 },
      }],
    });

    const result = await service.checkAndRecord({
      messageId: 'm-1',
      userId: 'u-1',
      content: 'flagged content',
    });

    expect(result?.flagged).toBe(true);
    expect(prisma.flaggedMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: 'm-1',
        userId: 'u-1',
        categories: ['hate'],
      }),
    });
  });

  it('writes nothing when OpenAI says it is safe', async () => {
    openaiClient.moderations.create.mockResolvedValue({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    });

    await service.checkAndRecord({ messageId: 'm-1', userId: 'u-1', content: 'hi' });

    expect(prisma.flaggedMessage.create).not.toHaveBeenCalled();
  });

  it('swallows OpenAI errors without throwing (fire-and-forget contract)', async () => {
    openaiClient.moderations.create.mockRejectedValue(new Error('rate limit'));

    await expect(
      service.checkAndRecord({ messageId: 'm-1', userId: 'u-1', content: 'hi' }),
    ).resolves.toBeNull();
    expect(prisma.flaggedMessage.create).not.toHaveBeenCalled();
  });

  it('returns null with no client wired (dev env without an OpenAI key)', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: { getClient: () => null } },
      ],
    }).compile();
    const local = moduleRef.get<ModerationService>(ModerationService);

    const res = await local.checkAndRecord({ messageId: 'm-1', userId: 'u-1', content: 'hi' });
    expect(res).toBeNull();
    expect(prisma.flaggedMessage.create).not.toHaveBeenCalled();
  });
});
