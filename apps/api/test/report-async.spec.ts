import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { ReportService } from '../src/modules/report/report.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { PaymentRequiredException } from '../src/common/exceptions/payment-required.exception';
import { REPORT_QUEUE } from '../src/queue/queue.module';
import { mockOpenAIService, mockKnowledgeService, mockKbService, mockUserService, mockUser } from './helpers/mocks';

// Pay-to-unlock gate. Default: a one-time entitlement is available.
const mockFeatureAccess = () => ({
  resolveUnlock: jest.fn().mockResolvedValue('entitlement'),
  consumeEntitlement: jest.fn().mockResolvedValue(undefined),
  isActiveSubscriber: jest.fn().mockResolvedValue(false),
  creditsEnabled: jest.fn().mockResolvedValue(true),
  paidFeaturesFree: jest.fn().mockResolvedValue(false),
  checkUsage: jest.fn().mockResolvedValue({ allowed: true, periodKey: 'LIFETIME', isSubscriber: false }),
  incrementUsage: jest.fn().mockResolvedValue(undefined),
  decrementUsage: jest.fn().mockResolvedValue(undefined),
  refundEntitlementByRef: jest.fn().mockResolvedValue(0),
});

describe('ReportService — Async Queue Path (Item 2)', () => {
  let service: ReportService;
  let prisma: any;
  let reportQueue: any;
  let userService: any;
  let featureAccess: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
      report: {
        create: jest.fn().mockResolvedValue({ id: 'report-1', createdAt: new Date(), type: 'LIFE', status: 'GENERATING', price: 5, userId: 'test-uuid' }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };

    reportQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    userService = mockUserService();
    featureAccess = mockFeatureAccess();

    const openaiService = mockOpenAIService();
    openaiService.chatCompletion.mockResolvedValue({
      sections: [{ title: 'Overview', content: 'Test', order: 1 }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const cfg: Record<string, any> = {
                'credits.reportCost': 5,
                'QUEUE_ENABLED': 'true',
              };
              return cfg[key] ?? def;
            }),
          },
        },
        { provide: UserService, useValue: userService },
        { provide: FeatureAccessService, useValue: featureAccess },
        { provide: OpenAIService, useValue: openaiService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
        { provide: getQueueToken(REPORT_QUEUE), useValue: reportQueue },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  describe('generateReport — async path', () => {
    it('should enqueue job and return generating status when queue enabled', async () => {
      const result = await service.generateReport('test-uuid', { type: 'LIFE' });

      expect(result.status).toBe('generating');
      expect(result.sections).toEqual([]);
      expect(reportQueue.add).toHaveBeenCalledWith('generate', expect.objectContaining({
        reportId: 'report-1',
        userId: 'test-uuid',
        type: 'LIFE',
        creditCost: 0,
      }));
    });

    it('should create report with GENERATING status', async () => {
      await service.generateReport('test-uuid', { type: 'CAREER' });

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'GENERATING' }),
        }),
      );
    });

    it('should consume the entitlement and enqueue job', async () => {
      await service.generateReport('test-uuid', { type: 'LIFE' });

      expect(featureAccess.consumeEntitlement).toHaveBeenCalledWith('test-uuid', 'REPORT_LIFE', 'report-1');
      expect(reportQueue.add).toHaveBeenCalled();
    });

    it('should reject when no unlock is available', async () => {
      featureAccess.resolveUnlock.mockRejectedValue(new PaymentRequiredException());

      await expect(
        service.generateReport('test-uuid', { type: 'LIFE' }),
      ).rejects.toThrow(PaymentRequiredException);
    });
  });

  describe('getReportStatus', () => {
    it('should return status for existing report', async () => {
      prisma.report.findFirst.mockResolvedValue({
        id: 'report-1',
        status: 'GENERATING',
        createdAt: new Date(),
      });

      const status = await service.getReportStatus('test-uuid', 'report-1');

      expect(status.id).toBe('report-1');
      expect(status.status).toBe('generating');
    });

    it('should include completedAt for READY reports', async () => {
      prisma.report.findFirst.mockResolvedValue({
        id: 'report-1',
        status: 'READY',
        createdAt: new Date(),
      });

      const status = await service.getReportStatus('test-uuid', 'report-1');

      expect(status.status).toBe('ready');
      expect(status.completedAt).toBeDefined();
    });

    it('should throw for non-existent report', async () => {
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(
        service.getReportStatus('test-uuid', 'nonexistent'),
      ).rejects.toThrow('Report not found');
    });
  });
});

describe('ReportService — Sync Fallback', () => {
  let service: ReportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
      report: {
        create: jest.fn().mockResolvedValue({ id: 'report-1', createdAt: new Date(), type: 'LIFE', status: 'GENERATING', price: 5, userId: 'test-uuid' }),
        // Sync path now creates GENERATING then flips to READY via update.
        update: jest.fn().mockResolvedValue({ id: 'report-1', createdAt: new Date(), type: 'LIFE', status: 'READY', price: 5, userId: 'test-uuid', fileUrl: '{}' }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const openaiService = mockOpenAIService();
    openaiService.chatCompletion.mockResolvedValue({
      sections: [{ title: 'Overview', content: 'Full content', order: 1 }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const cfg: Record<string, any> = {
                'credits.reportCost': 5,
                'QUEUE_ENABLED': 'false', // Queue disabled
              };
              return cfg[key] ?? def;
            }),
          },
        },
        { provide: UserService, useValue: mockUserService() },
        { provide: FeatureAccessService, useValue: mockFeatureAccess() },
        { provide: OpenAIService, useValue: openaiService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  it('should process synchronously when QUEUE_ENABLED=false', async () => {
    const result = await service.generateReport('test-uuid', { type: 'LIFE' });

    expect(result.status).toBe('completed');
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.completedAt).toBeDefined();
  });
});
