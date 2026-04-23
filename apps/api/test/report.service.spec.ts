import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { ReportService } from '../src/modules/report/report.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { mockKnowledgeService, mockKbService } from './helpers/mocks';

describe('ReportService', () => {
  let service: ReportService;
  let prisma: any;
  let userService: any;
  let openaiService: any;

  const mockUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    credits: 20,
    role: 'USER',
    dateOfBirth: new Date('1990-05-15'),
    timeOfBirth: '14:30',
    placeOfBirth: { name: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  };

  const mockReport = {
    id: 'report-1',
    userId: 'test-uuid',
    type: 'CAREER',
    title: 'Career Report',
    status: 'COMPLETED',
    sections: [
      { title: 'Overview', content: 'Career analysis content' },
      { title: 'Strengths', content: 'Your strengths in career' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      report: {
        create: jest.fn().mockResolvedValue(mockReport),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(mockReport),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(mockUser),
      getProfile: jest.fn().mockResolvedValue(mockUser),
    };

    openaiService = {
      chat: jest.fn().mockResolvedValue(null),
      chatCompletion: jest.fn().mockResolvedValue(null),
      getClient: jest.fn().mockReturnValue(null),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'openai.model': 'gpt-4o',
                'credits.reportCost': 5,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: openaiService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  describe('generateReport', () => {
    it('should deduct credits before generating report', async () => {
      prisma.report.create.mockResolvedValue(mockReport);
      prisma.report.update.mockResolvedValue(mockReport);

      await service.generateReport('test-uuid', { type: 'CAREER' });

      expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 5, expect.any(String));
    });

    it('should create report with correct type', async () => {
      prisma.report.create.mockResolvedValue(mockReport);
      prisma.report.update.mockResolvedValue(mockReport);

      const result = await service.generateReport('test-uuid', { type: 'CAREER' });

      expect(result).toBeDefined();
      expect(prisma.report.create).toHaveBeenCalled();
    });

    it('should generate fallback sections when OpenAI fails', async () => {
      openaiService.chat.mockResolvedValue(null);
      prisma.report.create.mockResolvedValue(mockReport);
      prisma.report.update.mockResolvedValue({
        ...mockReport,
        sections: [
          { title: 'Overview', content: 'Fallback content' },
        ],
      });

      const result = await service.generateReport('test-uuid', { type: 'LIFE' });

      expect(result).toBeDefined();
    });

    it('should support all report types', async () => {
      const types = ['LIFE', 'CAREER', 'MARRIAGE', 'WEALTH', 'PALM', 'ANNUAL'] as const;

      for (const type of types) {
        prisma.report.create.mockResolvedValue({ ...mockReport, type });
        prisma.report.update.mockResolvedValue({ ...mockReport, type });

        const result = await service.generateReport('test-uuid', { type });

        expect(result).toBeDefined();
      }
    });
  });

  describe('getReport', () => {
    it('should return report with sections', async () => {
      prisma.report.findFirst.mockResolvedValue(mockReport);

      const result = await service.getReport('test-uuid', 'report-1');

      expect(result.id).toBe('report-1');
      expect(result.sections).toBeDefined();
    });

    it('should throw NotFoundException for non-existent report', async () => {
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(
        service.getReport('test-uuid', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return reports belonging to other users', async () => {
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(
        service.getReport('other-user', 'report-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.report.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'other-user' }),
        }),
      );
    });
  });

  describe('getUserReports', () => {
    it('should return all reports for user', async () => {
      const reports = [
        { ...mockReport, id: 'report-1' },
        { ...mockReport, id: 'report-2', type: 'LIFE' },
      ];
      prisma.report.findMany.mockResolvedValue(reports);

      const result = await service.getUserReports('test-uuid');

      expect(result.length).toBe(2);
    });

    it('should return empty array for user with no reports', async () => {
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getUserReports('test-uuid');

      expect(result).toEqual([]);
    });

    it('should filter by userId', async () => {
      prisma.report.findMany.mockResolvedValue([]);

      await service.getUserReports('test-uuid');

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'test-uuid' },
        }),
      );
    });
  });
});
