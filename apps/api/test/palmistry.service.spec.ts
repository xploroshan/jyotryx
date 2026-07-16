import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { StorageService } from '../src/storage/storage.service';
import { mockKnowledgeService, mockStorageService, validPalmReadingJson } from './helpers/mocks';

function chatResponse(payload: unknown) {
  return {
    choices: [{ message: { content: JSON.stringify(payload) } }],
    usage: { prompt_tokens: 100, completion_tokens: 500, total_tokens: 600 },
  };
}

describe('PalmistryService', () => {
  let service: PalmistryService;
  let prisma: any;
  let userService: any;
  let featureAccess: any;
  let openaiService: any;
  let fakeCreate: jest.Mock;

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
        findFirst: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      addCredits: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(mockUser),
      deductWithRefund: jest.fn(async (
        _userId: string,
        _cost: number,
        _description: string,
        work: () => Promise<unknown>,
      ) => work()),
    };

    featureAccess = {
      resolveUnlock: jest.fn().mockResolvedValue('entitlement'),
      consumeEntitlement: jest.fn().mockResolvedValue(undefined),
      isActiveSubscriber: jest.fn().mockResolvedValue(false),
      // Credits on → the legacy entitlement path these specs assert.
      creditsEnabled: jest.fn().mockResolvedValue(true),
      paidFeaturesFree: jest.fn().mockResolvedValue(false),
      checkUsage: jest.fn().mockResolvedValue({ allowed: true, periodKey: 'LIFETIME', isSubscriber: false }),
      incrementUsage: jest.fn().mockResolvedValue(undefined),
    };

    // Fake OpenAI SDK client: first call returns the reading, second the
    // geometry polylines (the pipeline makes exactly these two calls).
    fakeCreate = jest
      .fn()
      .mockResolvedValueOnce(chatResponse(validPalmReadingJson()))
      .mockResolvedValueOnce(
        chatResponse({
          polylines: [
            { name: 'Heart Line', kind: 'major', points: [[0.2, 0.4], [0.4, 0.38], [0.6, 0.4], [0.8, 0.45]], confidence: 0.9 },
          ],
        }),
      );
    openaiService = {
      chat: jest.fn().mockResolvedValue(null),
      chatCompletion: jest.fn().mockResolvedValue(null),
      getClient: jest.fn().mockReturnValue({ chat: { completions: { create: fakeCreate } } }),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
      getModelForFeature: jest.fn().mockReturnValue('gpt-4o'),
      recordUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PalmistryService,
        { provide: PrismaService, useValue: prisma },
        { provide: FeatureAccessService, useValue: featureAccess },
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
    it('should gate palm analysis on a one-time entitlement', async () => {
      const imageBuffer = Buffer.from('fake-image-data');

      await service.analyzePalm('test-uuid', imageBuffer, 'image/jpeg');

      // Pay-to-unlock: resolve then consume the PALMISTRY entitlement once
      // the reading row exists; no credit deduction.
      expect(featureAccess.resolveUnlock).toHaveBeenCalledWith('test-uuid', 'PALMISTRY');
      expect(featureAccess.consumeEntitlement).toHaveBeenCalledWith('test-uuid', 'PALMISTRY', 'palm-1');
      expect(userService.deductWithRefund).not.toHaveBeenCalled();
    });

    it('returns the validated analysis with all required sections + verification', async () => {
      const result: any = await service.analyzePalm('test-uuid', Buffer.from('fake'), 'image/jpeg');

      expect(result.lines.length).toBeGreaterThanOrEqual(5);
      expect(result.mounts.length).toBeGreaterThanOrEqual(3);
      expect(result).toHaveProperty('overallReading');
      // Authenticity layer: verified id + content hash + factors present.
      expect(result.verification.authentic).toBe(true);
      expect(result.verification.verificationId).toBeTruthy();
      expect(result.verification.imageSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Array.isArray(result.factors)).toBe(true);
      expect(result.geometry?.polylines?.length).toBeGreaterThan(0);
    });

    it('HONESTY: fails with 503 and does NOT charge when the vision analysis fails', async () => {
      // Both attempts return garbage → PalmAnalysisFailedError → 503, no consume.
      fakeCreate.mockReset();
      fakeCreate.mockResolvedValue(chatResponse({ nonsense: true }));

      await expect(
        service.analyzePalm('test-uuid', Buffer.from('fake'), 'image/jpeg'),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(featureAccess.consumeEntitlement).not.toHaveBeenCalled();
      // A failed reading row is persisted for audit.
      expect(prisma.palmistryReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ analysisData: expect.objectContaining({ status: 'failed' }) }),
        }),
      );
    });

    it('HONESTY: fails with 503 (no charge) when an image is supplied but no vision client exists', async () => {
      openaiService.getClient.mockReturnValue(null);

      await expect(
        service.analyzePalm('test-uuid', Buffer.from('fake'), 'image/jpeg'),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(featureAccess.consumeEntitlement).not.toHaveBeenCalled();
    });

    it('soft-flags a byte-identical resubmission instead of blocking it', async () => {
      prisma.palmistryReading.findFirst.mockResolvedValue({
        id: 'palm-0',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      });

      const result: any = await service.analyzePalm('test-uuid', Buffer.from('fake'), 'image/jpeg');

      expect(result.verification.duplicateOf).toEqual({
        readingId: 'palm-0',
        createdAt: '2026-07-01T00:00:00.000Z',
      });
      // Still analysed + charged: a retry is a legitimate new reading.
      expect(featureAccess.consumeEntitlement).toHaveBeenCalled();
    });

    it('should save reading to database with verification columns', async () => {
      await service.analyzePalm('test-uuid', Buffer.from('fake-image-data'), 'image/jpeg');

      expect(prisma.palmistryReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imageSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
            verificationId: expect.any(String),
          }),
        }),
      );
    });

    it('grounds measurable claims against client-measured landmarks', async () => {
      // Landmarks describing a clearly LONG palm + SHORT fingers → Fire hand;
      // the model claimed Air, so grounding must correct it and record a check.
      const L = 0.4;
      const W = 0.7 * L;
      const wrist = { x: 0.5, y: 0.9, z: 0 };
      const rowY = wrist.y - L;
      const lm = new Array(21).fill(null).map(() => ({ x: 0.5, y: rowY, z: 0 }));
      lm[0] = wrist;
      lm[5] = { x: 0.5 - W / 2, y: rowY, z: 0 };
      lm[9] = { x: 0.5, y: rowY, z: 0 };
      lm[13] = { x: 0.5 + W / 6, y: rowY, z: 0 };
      lm[17] = { x: 0.5 + W / 2, y: rowY, z: 0 };
      // Short middle finger (~60% of palm length), straight up in 3 segments.
      const fingerLen = 0.6 * L;
      lm[10] = { x: 0.5, y: rowY - fingerLen / 3, z: 0 };
      lm[11] = { x: 0.5, y: rowY - (2 * fingerLen) / 3, z: 0 };
      lm[12] = { x: 0.5, y: rowY - fingerLen, z: 0 };

      const result: any = await service.analyzePalm(
        'test-uuid',
        Buffer.from('fake'),
        'image/jpeg',
        undefined,
        undefined,
        JSON.stringify({ landmarks: lm, handedness: 'Right', score: 0.95 }),
      );

      expect(result.handShape.type).toBe('Fire'); // corrected from claimed 'Air'
      const shapeCheck = result.verification.checks.find((c: any) => c.code === 'handShape.type');
      expect(shapeCheck).toMatchObject({ expected: 'Fire', observed: 'Air', pass: false });
      expect(result.geometry.metrics.handShape).toBe('Fire');
    });

    it('should handle missing image gracefully (labelled sample, never charged)', async () => {
      const result: any = await service.analyzePalm('test-uuid');

      expect(result).toBeDefined();
      expect(featureAccess.resolveUnlock).toHaveBeenCalledWith('test-uuid', 'PALMISTRY');
      // The no-image sample is honestly labelled.
      expect(result.verification.authentic).toBe(false);
      expect(result.verification.authenticReason).toBe('no_image');
    });

    it('does NOT consume the entitlement for a no-image request', async () => {
      await service.analyzePalm('test-uuid');

      expect(featureAccess.resolveUnlock).toHaveBeenCalledWith('test-uuid', 'PALMISTRY');
      expect(featureAccess.consumeEntitlement).not.toHaveBeenCalled();
    });

    it('does NOT count a metered reading for a no-image request', async () => {
      featureAccess.creditsEnabled.mockResolvedValue(false);

      await service.analyzePalm('test-uuid');

      expect(featureAccess.incrementUsage).not.toHaveBeenCalled();
    });
  });
});
