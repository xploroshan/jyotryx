import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/modules/auth/auth.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { UserService } from '../src/modules/user/user.service';
import { ReportService } from '../src/modules/report/report.service';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import {
  mockKnowledgeService,
  mockOpenAIService,
  mockPrismaService,
  mockConfigService,
  mockUserService,
  mockCacheService,
  mockUser,
  createMockRedis,
} from './helpers/mocks';

// ─── Performance: Auth Service ─────────────────────────────────────────────

describe('Performance: Auth Operations', () => {
  let authService: AuthService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: REDIS_CLIENT, useValue: createMockRedis() },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token'), verify: jest.fn() } },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should register user under 500ms (with bcrypt 12 rounds)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1', name: 'Perf Test', email: 'perf@example.com',
      phone: null, credits: 10, role: 'USER',
    });

    const start = performance.now();
    await authService.register({
      name: 'Perf Test',
      email: 'perf@example.com',
      password: 'StrongPass123!',
    });
    const elapsed = performance.now() - start;

    // bcrypt with 12 salt rounds typically takes 200-400ms
    expect(elapsed).toBeLessThan(500);
  });

  it('should login under 500ms (with bcrypt compare)', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('TestPass123!', 12);

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', name: 'User', email: 'login-perf@example.com',
      phone: null, credits: 10, role: 'USER', passwordHash: hash,
    });

    const start = performance.now();
    await authService.login({
      email: 'login-perf@example.com',
      password: 'TestPass123!',
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should generate OTP under 5ms', async () => {
    const start = performance.now();
    await authService.sendOtp({ phone: '+919999900099' });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
  });

  it('should batch 10 OTP generations under 20ms', async () => {
    const phones = Array.from({ length: 10 }, (_, i) => `+91777700000${i}`);

    const start = performance.now();
    await Promise.all(phones.map((phone) => authService.sendOtp({ phone })));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
  });
});

// ─── Performance: Credit Deduction ─────────────────────────────────────────

describe('Performance: Credit Operations', () => {
  let userService: UserService;

  beforeEach(async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(mockUser), update: jest.fn() },
      creditTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: -5 } }),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn({
        user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should deduct credits under 5ms (with mocked DB)', async () => {
    const start = performance.now();
    await userService.deductCredits('test-uuid', 1, 'Chat');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
  });

  it('should handle 100 sequential deductions under 100ms', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await userService.deductCredits('test-uuid', 1, `Deduction ${i}`);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('should handle 50 concurrent deductions under 50ms', async () => {
    const requests = Array.from({ length: 50 }, (_, i) =>
      userService.deductCredits('test-uuid', 1, `Concurrent ${i}`),
    );

    const start = performance.now();
    await Promise.all(requests);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('should get user profile under 5ms', async () => {
    const start = performance.now();
    await userService.getProfile('test-uuid');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
  });

  it('should get credits under 5ms', async () => {
    const start = performance.now();
    await userService.getCredits('test-uuid');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
  });
});

// ─── Performance: Chat Service ─────────────────────────────────────────────

describe('Performance: Chat Operations', () => {
  let chatService: ChatService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
  });

  it('should send message and get reply under 50ms (mocked AI)', async () => {
    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatSession.create.mockResolvedValue({
      id: 'session-perf', userId: 'test-uuid', title: 'Perf', category: 'general',
      createdAt: new Date(), updatedAt: new Date(), messages: [],
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 'msg-perf', sessionId: 'session-perf', role: 'ASSISTANT',
      content: 'Response', createdAt: new Date(),
    });

    const start = performance.now();
    await chatService.sendMessage('test-uuid', {
      message: 'Tell me about Mars transit',
      category: 'general',
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('should list sessions under 5ms', async () => {
    prisma.chatSession.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`, userId: 'test-uuid', title: `Session ${i}`,
        category: 'general', createdAt: new Date(), updatedAt: new Date(),
      })),
    );

    const start = performance.now();
    const sessions = await chatService.getSessions('test-uuid');
    const elapsed = performance.now() - start;

    expect(sessions.length).toBe(20);
    expect(elapsed).toBeLessThan(5);
  });

  it('should get session with 200 messages under 10ms', async () => {
    const messages = Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`, sessionId: 'session-big', role: i % 2 === 0 ? 'USER' : 'ASSISTANT',
      content: `Message ${i} with some content`, createdAt: new Date(),
    }));

    prisma.chatSession.findFirst.mockResolvedValue({
      id: 'session-big', userId: 'test-uuid', title: 'Big Session',
      category: 'general', createdAt: new Date(), updatedAt: new Date(),
      messages,
    });

    const start = performance.now();
    const session = await chatService.getSession('test-uuid', 'session-big');
    const elapsed = performance.now() - start;

    expect(session.messages.length).toBe(200);
    expect(elapsed).toBeLessThan(10);
  });

  it('should handle 20 concurrent message sends under 200ms', async () => {
    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatSession.create.mockResolvedValue({
      id: 'session-conc', userId: 'test-uuid', title: 'Concurrent', category: 'general',
      createdAt: new Date(), updatedAt: new Date(), messages: [],
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 'msg-conc', sessionId: 'session-conc', role: 'ASSISTANT',
      content: 'Concurrent response', createdAt: new Date(),
    });

    const requests = Array.from({ length: 20 }, (_, i) =>
      chatService.sendMessage('test-uuid', {
        message: `Concurrent message ${i}`,
        category: 'general',
      }),
    );

    const start = performance.now();
    await Promise.all(requests);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});

// ─── Performance: Report Service ───────────────────────────────────────────

describe('Performance: Report Operations', () => {
  let reportService: ReportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    reportService = module.get<ReportService>(ReportService);
  });

  it('should generate fallback report under 50ms', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.report.create.mockResolvedValue({
      id: 'report-perf', userId: 'test-uuid', type: 'LIFE',
      status: 'READY', price: 5, fileUrl: null, createdAt: new Date(),
    });

    const start = performance.now();
    await reportService.generateReport('test-uuid', { type: 'LIFE' });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('should retrieve cached report under 5ms', async () => {
    const cachedSections = Array.from({ length: 6 }, (_, i) => ({
      title: `Section ${i}`, content: 'Cached content '.repeat(50), order: i + 1,
    }));

    prisma.report.findFirst.mockResolvedValue({
      id: 'report-cached', userId: 'test-uuid', type: 'LIFE',
      status: 'READY', price: 5,
      fileUrl: JSON.stringify({ sections: cachedSections }),
      createdAt: new Date(),
    });

    const start = performance.now();
    const result = await reportService.getReport('test-uuid', 'report-cached');
    const elapsed = performance.now() - start;

    expect(result.sections.length).toBe(6);
    expect(elapsed).toBeLessThan(5);
  });

  it('should list user reports under 5ms', async () => {
    prisma.report.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`, userId: 'test-uuid', type: 'LIFE',
        status: 'READY', price: 5, fileUrl: null, createdAt: new Date(),
      })),
    );

    const start = performance.now();
    const reports = await reportService.getUserReports('test-uuid');
    const elapsed = performance.now() - start;

    expect(reports.length).toBe(10);
    expect(elapsed).toBeLessThan(5);
  });

  it('should generate all 6 report types under 200ms total', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const types = ['LIFE', 'CAREER', 'MARRIAGE', 'WEALTH', 'PALM', 'ANNUAL'] as const;

    const start = performance.now();
    for (const type of types) {
      prisma.report.create.mockResolvedValueOnce({
        id: `report-${type}`, userId: 'test-uuid', type,
        status: 'READY', price: 5, fileUrl: null, createdAt: new Date(),
      });
      await reportService.generateReport('test-uuid', { type });
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});

// ─── Performance: Numerology Service ───────────────────────────────────────

describe('Performance: Numerology Calculations', () => {
  let numerologyService: NumerologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumerologyService,
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    numerologyService = module.get<NumerologyService>(NumerologyService);
  });

  it('should compute 200 name analyses under 500ms', async () => {
    const names = Array.from({ length: 200 }, (_, i) => `TestName${i}Alpha`);

    const start = performance.now();
    await Promise.all(names.map((n) => numerologyService.analyzeName(n)));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should compute 200 brand analyses under 500ms', async () => {
    const brands = Array.from({ length: 200 }, (_, i) => `Brand${i}Corp`);

    const start = performance.now();
    await Promise.all(brands.map((b) => numerologyService.analyzeBrand(b)));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should compute 200 personal year calculations under 500ms', async () => {
    const dates = Array.from({ length: 200 }, (_, i) => {
      const year = 1970 + (i % 55);
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });

    const start = performance.now();
    await Promise.all(dates.map((d) => numerologyService.getPersonalYear(d)));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should produce consistent results across runs', async () => {
    const result1 = await numerologyService.analyzeName('Consistency Test');
    const result2 = await numerologyService.analyzeName('Consistency Test');

    expect(result1.destinyNumber).toBe(result2.destinyNumber);
  });
});

// ─── Performance: Daily Briefing ───────────────────────────────────────────

describe('Performance: Daily Briefing', () => {
  let dailyBriefingService: DailyBriefingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyBriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: MemoryCacheService, useValue: mockCacheService() },
      ],
    }).compile();

    dailyBriefingService = module.get<DailyBriefingService>(DailyBriefingService);
  });

  it('should generate briefing under 100ms', async () => {
    const start = performance.now();
    await dailyBriefingService.getDailyBriefing('test-uuid');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('should compute planetary hours under 10ms', async () => {
    const start = performance.now();
    await dailyBriefingService.getPlanetaryHoursOnly();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('should handle 50 concurrent briefing requests under 500ms', async () => {
    const requests = Array.from({ length: 50 }, () =>
      dailyBriefingService.getDailyBriefing('test-uuid'),
    );

    const start = performance.now();
    await Promise.all(requests);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });
});

// ─── Performance: Cache Service ────────────────────────────────────────────

describe('Performance: Cache Operations', () => {
  let cache: MemoryCacheService;

  beforeEach(() => {
    cache = new MemoryCacheService(createMockRedis() as any);
  });

  it('should handle 2000 sequential writes under 500ms', async () => {
    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      await cache.set(`perf-key-${i}`, { data: `value-${i}`, nested: { deep: true } }, 60000);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should handle 2000 sequential reads under 500ms', async () => {
    for (let i = 0; i < 2000; i++) {
      await cache.set(`read-key-${i}`, { data: `value-${i}` }, 60000);
    }

    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      await cache.get(`read-key-${i}`);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should handle mixed read/write under 500ms', async () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await cache.set(`mixed-${i}`, { v: i }, 60000);
      await cache.get(`mixed-${Math.floor(i / 2)}`);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should handle rapid overwrite of same key efficiently', async () => {
    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      await cache.set('single-key', { iteration: i }, 60000);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(await cache.get('single-key')).toEqual({ iteration: 1999 });
  });
});

// ─── Performance: Knowledge Service ────────────────────────────────────────

describe('Performance: Knowledge Service', () => {
  let knowledgeService: KnowledgeService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 50 }),
        count: jest.fn().mockResolvedValue(1000),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
      ],
    }).compile();

    knowledgeService = module.get<KnowledgeService>(KnowledgeService);
  });

  it('should handle 200 sequential searches under 300ms', async () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      await knowledgeService.search(`query ${i}`);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(300);
  });

  it('should assemble context from 200 results under 10ms', () => {
    const results = Array.from({ length: 200 }, (_, i) => ({
      id: `doc-${i}`,
      text: `Vedic astrology document ${i} with planetary analysis and transit effects. `.repeat(10),
      category: 'planets',
      topic: null,
      source: 'BPHS',
      score: Math.random(),
    }));

    const start = performance.now();
    const context = knowledgeService.assembleContext(results);
    const elapsed = performance.now() - start;

    expect(context.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('should batch-add 500 documents efficiently', async () => {
    const documents = Array.from({ length: 500 }, (_, i) => ({
      text: `Bulk document ${i} about Vedic astrology`,
      category: 'test',
      topic: 'bulk_test',
      source: 'test',
    }));

    const start = performance.now();
    await knowledgeService.addDocuments(documents);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
    // Should batch into 10 calls (500 / 50)
    expect(prisma.knowledgeDocument.createMany).toHaveBeenCalledTimes(10);
  });
});

// ─── Performance: DTO Validation ───────────────────────────────────────────

describe('Performance: DTO Validation', () => {
  it('should validate 100 SendMessageDto instances under 200ms', async () => {
    const { plainToInstance } = await import('class-transformer');
    const { validate } = await import('class-validator');
    const { SendMessageDto } = await import('../src/modules/chat/dto/send-message.dto');

    const dtos = Array.from({ length: 100 }, (_, i) =>
      plainToInstance(SendMessageDto, { message: `Message ${i}`, category: 'general' }),
    );

    const start = performance.now();
    await Promise.all(dtos.map((dto) => validate(dto)));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });

  it('should validate 100 SetPasswordDto instances under 200ms', async () => {
    const { plainToInstance } = await import('class-transformer');
    const { validate } = await import('class-validator');
    const { SetPasswordDto } = await import('../src/modules/auth/dto/set-password.dto');

    const dtos = Array.from({ length: 100 }, (_, i) =>
      plainToInstance(SetPasswordDto, { password: `StrongPass${i}A1` }),
    );

    const start = performance.now();
    await Promise.all(dtos.map((dto) => validate(dto)));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});

// ─── Performance: Memory Stability ─────────────────────────────────────────

describe('Performance: Memory Stability', () => {
  it('should not leak memory during sustained cache operations', async () => {
    const cache = new MemoryCacheService(createMockRedis() as any);
    const baselineMemory = process.memoryUsage().heapUsed;

    // Perform many operations
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < 500; i++) {
        await cache.set(`mem-${round}-${i}`, { data: 'x'.repeat(100) }, 1); // 1ms TTL
      }
    }

    // Wait for TTLs to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Trigger reads which should clean up expired entries
    for (let i = 0; i < 100; i++) {
      await cache.get(`mem-0-${i}`);
    }

    const afterMemory = process.memoryUsage().heapUsed;
    const growthMB = (afterMemory - baselineMemory) / 1024 / 1024;

    // Memory growth should be under 50MB
    expect(growthMB).toBeLessThan(50);
  });

  it('should handle JSON parse of large cached report sections efficiently', () => {
    const largeSections = Array.from({ length: 20 }, (_, i) => ({
      title: `Section ${i}`,
      content: 'Detailed content about planetary positions and transit effects. '.repeat(100),
      order: i + 1,
    }));
    const jsonString = JSON.stringify({ sections: largeSections });

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      JSON.parse(jsonString);
    }
    const elapsed = performance.now() - start;

    // 100 parses of large JSON should be under 50ms
    expect(elapsed).toBeLessThan(50);
  });
});
