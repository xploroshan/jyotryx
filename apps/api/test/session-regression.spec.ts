/**
 * Regression tests for bugs fixed in the OAuth / auth-flow session.
 * Each `describe` block pins one production outage we already debugged so the
 * fix cannot silently regress:
 *
 *  1. `PrismaService.normalizeUrl` — Railway healthcheck was failing with
 *     `42P05 prepared statement "sN" already exists` because the runtime
 *     DATABASE_URL targeted Supabase's PgBouncer pooler and Prisma was
 *     still issuing named prepared statements. See apps/api/src/prisma/
 *     prisma.service.ts (commit 3a8bd1d).
 *
 *  2. `HealthController` — same outage also required swapping the readiness
 *     probe from `$queryRaw\`SELECT 1\`` (tagged template → prepared) to
 *     `$queryRawUnsafe('SELECT 1')` (simple query → no prepared statement).
 *     See apps/api/src/health/health.controller.ts.
 *
 *  3. `AuthService.signupCredits` — production register endpoint was 500ing
 *     with `Prisma user.create: Argument 'credits' is missing` because
 *     `ConfigService.get('credits.freeMonthly')` returned `undefined`/`NaN`
 *     on Railway. The defensive getter coerces any shape of value into a
 *     finite non-negative integer. See commit 26ec1e9.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createMockRedis } from './helpers/mocks';

// -----------------------------------------------------------------------------
// 1. PrismaService.normalizeUrl
// -----------------------------------------------------------------------------

describe('PrismaService.normalizeUrl (session-regression)', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  it('returns the empty string unchanged', () => {
    expect(PrismaService.normalizeUrl('')).toBe('');
  });

  describe('on a Supabase PgBouncer pooler host', () => {
    const pooler =
      'postgresql://user:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

    it('appends pgbouncer=true (prod)', () => {
      process.env.NODE_ENV = 'production';
      const out = PrismaService.normalizeUrl(pooler);
      expect(out).toMatch(/[?&]pgbouncer=true/);
    });

    it('appends pgbouncer=true (non-prod too — the pooler host is what matters)', () => {
      process.env.NODE_ENV = 'development';
      const out = PrismaService.normalizeUrl(pooler);
      expect(out).toMatch(/[?&]pgbouncer=true/);
    });

    it('also appends sslmode=require in production', () => {
      process.env.NODE_ENV = 'production';
      const out = PrismaService.normalizeUrl(pooler);
      expect(out).toMatch(/[?&]sslmode=require/);
      expect(out).toMatch(/[?&]pgbouncer=true/);
    });

    it('is idempotent — re-running does not duplicate flags', () => {
      process.env.NODE_ENV = 'production';
      const once = PrismaService.normalizeUrl(pooler);
      const twice = PrismaService.normalizeUrl(once);
      expect(twice).toBe(once);
      // Only one of each param
      expect(twice.match(/pgbouncer=/g)?.length).toBe(1);
      expect(twice.match(/sslmode=/g)?.length).toBe(1);
    });

    it('preserves an explicitly set pgbouncer=false', () => {
      process.env.NODE_ENV = 'production';
      const url = `${pooler}?pgbouncer=false`;
      const out = PrismaService.normalizeUrl(url);
      expect(out).toContain('pgbouncer=false');
      expect(out).not.toContain('pgbouncer=true');
    });

    it('uses `&` when the URL already has a query string', () => {
      process.env.NODE_ENV = 'production';
      const url = `${pooler}?schema=public`;
      const out = PrismaService.normalizeUrl(url);
      expect(out).toContain('?schema=public');
      expect(out).toMatch(/&pgbouncer=true/);
      expect(out).toMatch(/&sslmode=require/);
    });

    it('detects the pooler even on the transaction port (6543)', () => {
      process.env.NODE_ENV = 'production';
      const url =
        'postgresql://user:pw@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
      const out = PrismaService.normalizeUrl(url);
      expect(out).toMatch(/[?&]pgbouncer=true/);
    });
  });

  describe('on a non-pooler / direct host', () => {
    const direct = 'postgresql://user:pw@db.example.com:5432/postgres';

    it('does NOT append pgbouncer=true', () => {
      process.env.NODE_ENV = 'production';
      const out = PrismaService.normalizeUrl(direct);
      expect(out).not.toMatch(/pgbouncer=/);
    });

    it('still appends sslmode=require in production', () => {
      process.env.NODE_ENV = 'production';
      const out = PrismaService.normalizeUrl(direct);
      expect(out).toMatch(/[?&]sslmode=require/);
    });

    it('leaves the URL alone in non-production', () => {
      process.env.NODE_ENV = 'development';
      const out = PrismaService.normalizeUrl(direct);
      expect(out).toBe(direct);
    });
  });

  it('treats any URL containing "pgbouncer" as a pooler', () => {
    process.env.NODE_ENV = 'production';
    // Hypothetical: a self-hosted pgbouncer, no supabase in hostname.
    const url = 'postgresql://user:pw@pgbouncer.internal:6432/postgres';
    const out = PrismaService.normalizeUrl(url);
    expect(out).toMatch(/[?&]pgbouncer=true/);
  });

  it('respects an explicit sslmode already present', () => {
    process.env.NODE_ENV = 'production';
    const url =
      'postgresql://user:pw@db.example.com:5432/postgres?sslmode=disable';
    const out = PrismaService.normalizeUrl(url);
    expect(out).toContain('sslmode=disable');
    expect(out).not.toContain('sslmode=require');
  });
});

// -----------------------------------------------------------------------------
// 2. HealthController uses $queryRawUnsafe (not $queryRaw)
// -----------------------------------------------------------------------------

describe('HealthController readiness probe (session-regression)', () => {
  // Lazy-require to avoid pulling in NestJS metadata at module load
  const { HealthController } = require('../src/health/health.controller');

  function buildController({
    dbOk = true,
    redisOk = true,
  }: { dbOk?: boolean; redisOk?: boolean } = {}) {
    const prisma: any = {
      $queryRaw: jest.fn(),
      $queryRawUnsafe: jest.fn(
        dbOk
          ? () => Promise.resolve([{ ok: 1 }])
          : () =>
              Promise.reject(
                Object.assign(new Error('prepared statement "s2" already exists'), {
                  code: '42P05',
                }),
              ),
      ),
    };
    const redis: any = {
      ping: jest.fn(
        redisOk ? async () => 'PONG' : async () => 'NOT-PONG',
      ),
    };
    const health: any = {
      check: jest.fn(async (indicators: Array<() => Promise<any>>) => {
        const results = await Promise.all(
          indicators.map(async (fn) => {
            try {
              return { result: await fn() };
            } catch (e) {
              return { error: e };
            }
          }),
        );
        return results;
      }),
    };
    return { ctrl: new HealthController(health, prisma, redis), prisma, redis };
  }

  it('calls $queryRawUnsafe with the literal "SELECT 1" — no tagged template', async () => {
    const { ctrl, prisma } = buildController();
    await ctrl.ready();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    // Regression guard: must NOT fall back to $queryRaw (tagged template
    // emits a prepared statement on PgBouncer, which is what broke prod).
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('throws HealthCheckError when Prisma surfaces 42P05 prepared-statement error', async () => {
    const { ctrl } = buildController({ dbOk: false });
    const results: any[] = await ctrl.ready();
    const dbResult = results[0];
    expect(dbResult.error).toBeInstanceOf(HealthCheckError);
    expect((dbResult.error as HealthCheckError).message).toMatch(
      /Database check failed/,
    );
    expect((dbResult.error as HealthCheckError).causes).toEqual({
      database: {
        status: 'down',
        message: expect.stringContaining('prepared statement'),
      },
    });
  });

  it('returns up when both Prisma and Redis respond', async () => {
    const { ctrl } = buildController();
    const results: any[] = await ctrl.ready();
    expect(results[0].result).toEqual({ database: { status: 'up' } });
    expect(results[1].result).toEqual({ redis: { status: 'up' } });
  });

  it('liveness probe is always {status:"ok"}', () => {
    const { ctrl } = buildController();
    expect(ctrl.live()).toEqual({ status: 'ok' });
  });
});

// -----------------------------------------------------------------------------
// 3. AuthService.signupCredits defensive getter
// -----------------------------------------------------------------------------

describe('AuthService signupCredits fallback (session-regression)', () => {
  let prisma: any;
  let jwtService: any;

  async function buildWithCreditsConfig(value: unknown) {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({
          id: 'u1',
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          credits: data.credits,
          role: 'USER',
          dateOfBirth: null,
          timeOfBirth: null,
          placeOfBirth: null,
          gender: null,
          preferredLanguage: 'en',
        })),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('tkn'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: REDIS_CLIENT, useValue: createMockRedis() },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'credits.freeMonthly') return value;
              if (key === 'jwt.secret') return 's';
              if (key === 'jwt.expiresIn') return '7d';
              if (key === 'jwt.refreshSecret') return 'r';
              if (key === 'jwt.refreshExpiresIn') return '30d';
              if (key === 'otp.length') return 6;
              if (key === 'otp.expiresInMinutes') return 5;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    return module.get<AuthService>(AuthService);
  }

  const registerDto = {
    name: 'Test',
    email: 'test@example.com',
    password: 'StrongPass123!',
  } as any;

  // Each case: config value → expected credits passed to user.create
  const cases: Array<[string, unknown, number]> = [
    ['numeric 15', 15, 15],
    ['numeric 0 (allowed — no free tier)', 0, 0],
    ['undefined (ConfigService returned nothing)', undefined, 10],
    ['null', null, 10],
    ['NaN (parseInt of garbage)', NaN, 10],
    ['empty string', '', 10],
    ['string "20"', '20', 20],
    ['string " 25 " with whitespace', ' 25 ', 25],
    ['non-numeric string "abc"', 'abc', 10],
    ['negative number -5 rejected', -5, 10],
    ['object {} (nonsense)', {}, 10],
  ];

  test.each(cases)(
    'register() passes concrete integer credits to prisma.user.create when config is %s',
    async (_desc, configValue, expected) => {
      const service = await buildWithCreditsConfig(configValue);
      await service.register(registerDto);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(typeof createArgs.data.credits).toBe('number');
      expect(Number.isFinite(createArgs.data.credits)).toBe(true);
      expect(createArgs.data.credits).toBe(expected);
    },
  );

  it('never passes undefined for credits — Prisma would reject it', async () => {
    const service = await buildWithCreditsConfig(undefined);
    await service.register(registerDto);
    const args = prisma.user.create.mock.calls[0][0];
    expect(args.data.credits).not.toBeUndefined();
    expect(args.data.credits).not.toBeNull();
    expect(Number.isNaN(args.data.credits)).toBe(false);
  });
});
