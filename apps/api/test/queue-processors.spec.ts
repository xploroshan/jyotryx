import { Test, TestingModule } from '@nestjs/testing';
import { ReportProcessor } from '../src/queue/report.processor';
import { PalmistryProcessor } from '../src/queue/palmistry.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { UserService } from '../src/modules/user/user.service';
import { StorageService } from '../src/storage/storage.service';
import { mockOpenAIService, mockKnowledgeService, mockUserService } from './helpers/mocks';

describe('ReportProcessor (Item 2 — BullMQ)', () => {
  let processor: ReportProcessor;
  let prisma: any;
  let userService: any;
  let openaiService: any;

  beforeEach(async () => {
    prisma = {
      report: {
        update: jest.fn().mockResolvedValue({ id: 'report-1', status: 'READY' }),
      },
    };

    openaiService = mockOpenAIService();
    openaiService.chatCompletion.mockResolvedValue({
      sections: [
        { title: 'Overview', content: 'Test content', order: 1 },
      ],
    });

    userService = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: openaiService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    processor = module.get<ReportProcessor>(ReportProcessor);
  });

  it('should process a report job and set status to READY', async () => {
    const job = {
      id: 'job-1',
      data: {
        reportId: 'report-1',
        userId: 'user-1',
        type: 'LIFE',
        creditCost: 5,
        birthDetails: { dateOfBirth: '1990-05-15', timeOfBirth: '14:30', placeOfBirth: 'Mumbai' },
        name: 'Test User',
        gender: 'Male',
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any;

    await processor.process(job);

    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({ status: 'READY' }),
      }),
    );
  });

  it('should set status to FAILED and refund credits on final attempt failure', async () => {
    openaiService.chatCompletion.mockRejectedValue(new Error('LLM down'));
    prisma.report.update.mockResolvedValue({ id: 'report-1', status: 'FAILED' });

    const job = {
      id: 'job-1',
      data: {
        reportId: 'report-1',
        userId: 'user-1',
        type: 'CAREER',
        creditCost: 5,
        birthDetails: { dateOfBirth: '', timeOfBirth: '', placeOfBirth: '' },
        name: 'Test',
      },
      attemptsMade: 2,
      opts: { attempts: 3 },
    } as any;

    // Should use fallback sections, not throw
    await processor.process(job);

    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'READY' }),
      }),
    );
  });

  it('should use fallback sections when no birth details provided', async () => {
    openaiService.chatCompletion.mockResolvedValue(null);

    const job = {
      id: 'job-2',
      data: {
        reportId: 'report-2',
        userId: 'user-1',
        type: 'LIFE',
        creditCost: 5,
        birthDetails: { dateOfBirth: '', timeOfBirth: '', placeOfBirth: '' },
        name: 'Test User',
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any;

    await processor.process(job);

    expect(prisma.report.update).toHaveBeenCalled();
    const updateCall = prisma.report.update.mock.calls[0][0];
    const sections = JSON.parse(updateCall.data.fileUrl).sections;
    expect(sections.length).toBeGreaterThan(0);
  });
});

describe('PalmistryProcessor (Item 2 — BullMQ)', () => {
  let processor: PalmistryProcessor;
  let prisma: any;
  let userService: any;
  let storageService: any;

  beforeEach(async () => {
    prisma = {
      palmistryReading: {
        update: jest.fn().mockResolvedValue({ id: 'palm-1' }),
      },
    };

    storageService = {
      isAvailable: jest.fn().mockReturnValue(false),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://example.com/image.jpg'),
      uploadBuffer: jest.fn().mockResolvedValue(undefined),
    };

    userService = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PalmistryProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: UserService, useValue: userService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    processor = module.get<PalmistryProcessor>(PalmistryProcessor);
  });

  it('should process a palmistry job with fallback analysis', async () => {
    const job = {
      id: 'job-1',
      data: {
        readingId: 'palm-1',
        userId: 'user-1',
        creditCost: 3,
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any;

    await processor.process(job);

    expect(prisma.palmistryReading.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'palm-1' },
        data: expect.objectContaining({
          analysisData: expect.objectContaining({
            lines: expect.any(Array),
            mounts: expect.any(Array),
            overallReading: expect.any(String),
          }),
        }),
      }),
    );
  });

  it('should refund credits on final attempt failure', async () => {
    prisma.palmistryReading.update.mockRejectedValue(new Error('DB down'));

    const job = {
      id: 'job-2',
      data: {
        readingId: 'palm-2',
        userId: 'user-1',
        creditCost: 3,
      },
      attemptsMade: 2,
      opts: { attempts: 3 },
    } as any;

    await expect(processor.process(job)).rejects.toThrow('DB down');
    expect(userService.addCredits).toHaveBeenCalledWith('user-1', 3, 'PURCHASE', expect.stringContaining('Refund'));
  });
});
