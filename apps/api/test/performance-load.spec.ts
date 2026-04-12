/**
 * Performance Load Tests
 *
 * Validates API response times and concurrency handling with mocked dependencies.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/modules/auth/auth.service';
import { StatsService } from '../src/stats/stats.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaReadReplicaService } from '../src/prisma/prisma-read-replica.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import {
  mockPrismaService,
  mockConfigService,
  createMockRedis,
} from './helpers/mocks';

describe('Performance: API Response Benchmarks', () => {
  let authService: AuthService;
  let statsService: StatsService;
  let metricsService: MetricsService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    redis = createMockRedis();

    const client = await import('prom-client');
    client.register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        StatsService,
        MetricsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaReadReplicaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token'), verify: jest.fn() } },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    statsService = module.get<StatsService>(StatsService);
    metricsService = module.get<MetricsService>(MetricsService);

    // Set up default mock responses for stats
    prisma.user.count.mockResolvedValue(100);
    prisma.subscription.count.mockResolvedValue(15);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 50000 }, _count: 10 });
    prisma.chatSession.count.mockResolvedValue(200);
    prisma.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: -350 } });
    prisma.kundliChart.count.mockResolvedValue(50);
    prisma.matchingResult.count.mockResolvedValue(20);
    prisma.palmistryReading.count.mockResolvedValue(10);
    prisma.report.count.mockResolvedValue(30);
    prisma.tarotReading.count.mockResolvedValue(25);
    prisma.llmUsage.aggregate.mockResolvedValue({
      _sum: { costUsd: 12.5, totalTokens: 50000 }, _count: 100,
    });
  });

  afterEach(() => redis.__clear());

  it('OTP send should complete under 100ms with mocked deps', async () => {
    const start = performance.now();
    await authService.sendOtp({ phone: '+919876543210' });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('stats computation should complete under 200ms with mocked Prisma', async () => {
    const start = performance.now();
    await statsService.computeAndStoreDailyStats(new Date('2026-04-10'));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('metrics endpoint should respond under 50ms', async () => {
    const start = performance.now();
    await metricsService.getMetrics();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('concurrent OTP sends (20 parallel) should complete under 2s', async () => {
    const phones = Array.from({ length: 20 }, (_, i) => `+91900000000${String(i).padStart(2, '0')}`);

    const start = performance.now();
    await Promise.all(phones.map((phone) => authService.sendOtp({ phone })));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it('concurrent stats computations (5 parallel) should complete under 1s', async () => {
    const dates = Array.from({ length: 5 }, (_, i) => {
      const d = new Date('2026-04-01');
      d.setDate(d.getDate() + i);
      return d;
    });

    const start = performance.now();
    await Promise.all(dates.map((d) => statsService.computeAndStoreDailyStats(d)));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  it('refreshToken should complete under 50ms with mocked deps', async () => {
    const jwtService = { signAsync: jest.fn().mockResolvedValue('token'), verify: jest.fn() };
    jwtService.verify.mockReturnValue({ sub: 'u1', email: 'e', name: 'n' }); // legacy token
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'e', name: 'n' });

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    const svc = module.get<AuthService>(AuthService);

    const start = performance.now();
    await svc.refreshToken({ refreshToken: 'legacy' });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
