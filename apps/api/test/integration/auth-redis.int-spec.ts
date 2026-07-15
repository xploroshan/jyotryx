import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration test: Phase 0 migration of OTP state and login-lockout
 * counters from per-process Maps into Redis.
 *
 * The test wires an AuthService against a real Redis, real Postgres
 * (for the user row), and real JwtService. It then asserts that OTP and
 * lockout state survive a simulated pod restart — i.e. a brand-new
 * AuthService instance built from the same Redis URL sees the state.
 *
 * Why this matters: the previous implementation stored OTPs and failed
 * login counters in module-level Maps. On a multi-pod deploy, a user
 * who got their OTP SMS from pod A couldn't verify it against pod B,
 * and lockout counts could be trivially bypassed by retrying until the
 * load balancer routed them to a cold pod. These tests would have
 * failed on the old implementation.
 */
describe('AuthService — Redis-backed OTP & lockout (Phase 0)', () => {
  let redis: Redis;
  let prisma: PrismaService;
  let auth: AuthService;
  let configService: ConfigService;
  let jwtService: JwtService;

  const TEST_EMAIL = 'auth-redis-int@example.com';
  const TEST_PHONE = '+919999000011';

  beforeAll(async () => {
    // Point PrismaService at the ephemeral Postgres set up by globalSetup.
    process.env.DATABASE_URL = process.env.TEST_POSTGRES_URL!;

    prisma = new PrismaService();
    await prisma.$connect();

    redis = new Redis({
      host: process.env.TEST_REDIS_HOST!,
      port: Number(process.env.TEST_REDIS_PORT),
    });

    configService = new ConfigService({
      jwt: { secret: 'test', expiresIn: '1d', refreshSecret: 'test-r', refreshExpiresIn: '30d' },
      otp: { length: 6, expiresInMinutes: 5, exposeOtpInResponse: true },
      credits: { freeMonthly: 10 },
      sms: { provider: '' },
      firebase: { serviceAccountJson: '', projectId: '' },
    });

    jwtService = new JwtService({
      secret: 'test',
      signOptions: { expiresIn: '1d' },
    });

    auth = new AuthService(prisma, jwtService, configService, redis);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushall();
    // Clean up any user rows from previous tests.
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: TEST_EMAIL },
          { phone: TEST_PHONE },
          { email: { contains: '@phone.myastro360.com' } },
          { email: { endsWith: '@example.com' } },
        ],
      },
    });
  });

  describe('OTP state in Redis', () => {
    it('sendOtp writes otp:<phone> with a TTL', async () => {
      const result = await auth.sendOtp({ phone: TEST_PHONE });
      expect(result.message).toBe('OTP sent successfully');

      const stored = await redis.get(`otp:${TEST_PHONE}`);
      expect(stored).toBeTruthy();
      expect(stored).toMatch(/^\d{6}$/);

      const ttl = await redis.ttl(`otp:${TEST_PHONE}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300); // 5 min default
    });

    it('verifyOtp consumes the Redis key and creates the user', async () => {
      const sendResult = await auth.sendOtp({ phone: TEST_PHONE });
      const otp = sendResult.devOtp!; // exposed in test config
      expect(otp).toMatch(/^\d{6}$/);

      const verified = await auth.verifyOtp({ phone: TEST_PHONE, otp });
      expect(verified.user).toBeDefined();
      expect(verified.user.phone).toBe(TEST_PHONE);
      expect(verified.tokens.accessToken).toBeTruthy();

      // Key consumed on successful verify.
      expect(await redis.get(`otp:${TEST_PHONE}`)).toBeNull();

      // User row created.
      const row = await prisma.user.findUnique({ where: { phone: TEST_PHONE } });
      expect(row).toBeTruthy();
    });

    it('verifyOtp rejects incorrect code without deleting the Redis key', async () => {
      await auth.sendOtp({ phone: TEST_PHONE });

      await expect(auth.verifyOtp({ phone: TEST_PHONE, otp: '000000' })).rejects.toThrow(
        /Invalid OTP/,
      );

      // Key should still be there for the next retry.
      expect(await redis.get(`otp:${TEST_PHONE}`)).not.toBeNull();
    });

    it('OTP state survives a simulated pod restart (new AuthService, same Redis)', async () => {
      const sent = await auth.sendOtp({ phone: TEST_PHONE });
      const otp = sent.devOtp!;

      // Simulate pod restart: build a brand-new AuthService against the same
      // Redis + Postgres, exactly how a horizontally-scaled replica would.
      const freshRedis = new Redis({
        host: process.env.TEST_REDIS_HOST!,
        port: Number(process.env.TEST_REDIS_PORT),
      });
      const freshPrisma = new PrismaService();
      await freshPrisma.$connect();
      const freshAuth = new AuthService(freshPrisma, jwtService, configService, freshRedis);

      try {
        const verified = await freshAuth.verifyOtp({ phone: TEST_PHONE, otp });
        expect(verified.user.phone).toBe(TEST_PHONE);
      } finally {
        await freshPrisma.$disconnect();
        await freshRedis.quit();
      }
    });

    it('sendOtp rate-limits repeated requests within TTL window', async () => {
      await auth.sendOtp({ phone: TEST_PHONE });
      // Immediately sending again should hit the cooldown guard.
      await expect(auth.sendOtp({ phone: TEST_PHONE })).rejects.toThrow(/wait/i);
    });
  });

  describe('Login lockout counters in Redis', () => {
    beforeEach(async () => {
      // Seed a user with a known password so the wrong-password path fails
      // on hash mismatch rather than "user not found".
      await prisma.user.create({
        data: {
          name: 'Lockout Tester',
          email: TEST_EMAIL,
          phone: '+919999000022',
          credits: 10,
          // bcrypt('right-password') — static hash so we don't re-hash every run.
          passwordHash: await require('bcrypt').hash('right-password', 10),
          // These lockout tests exercise the successful-login path, which now
          // requires a verified email (blocking email verification).
          emailVerified: true,
        },
      });
    });

    it('failed attempts increment login:fail:<email>', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          auth.login({ email: TEST_EMAIL, password: 'wrong' }),
        ).rejects.toThrow();
      }
      const count = await redis.get(`login:fail:${TEST_EMAIL}`);
      expect(Number(count)).toBe(3);
    });

    it('locks the account after 5 failures and sets login:lock:<email>', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          auth.login({ email: TEST_EMAIL, password: 'wrong' }),
        ).rejects.toThrow();
      }
      const locked = await redis.get(`login:lock:${TEST_EMAIL}`);
      expect(locked).toBe('1');
      // After lock, even the correct password is rejected.
      await expect(
        auth.login({ email: TEST_EMAIL, password: 'right-password' }),
      ).rejects.toThrow(/locked/i);
    });

    it('successful login clears both fail and lock keys', async () => {
      // Rack up 2 failures, well under the threshold, then succeed.
      await expect(
        auth.login({ email: TEST_EMAIL, password: 'wrong' }),
      ).rejects.toThrow();
      await expect(
        auth.login({ email: TEST_EMAIL, password: 'wrong' }),
      ).rejects.toThrow();
      expect(Number(await redis.get(`login:fail:${TEST_EMAIL}`))).toBe(2);

      const ok = await auth.login({ email: TEST_EMAIL, password: 'right-password' });
      expect(ok.tokens.accessToken).toBeTruthy();

      expect(await redis.get(`login:fail:${TEST_EMAIL}`)).toBeNull();
      expect(await redis.get(`login:lock:${TEST_EMAIL}`)).toBeNull();
    });

    it('lockout state is visible from a second AuthService instance (cross-pod)', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          auth.login({ email: TEST_EMAIL, password: 'wrong' }),
        ).rejects.toThrow();
      }

      // Second "pod" reads the same Redis — lock must carry over.
      const freshRedis = new Redis({
        host: process.env.TEST_REDIS_HOST!,
        port: Number(process.env.TEST_REDIS_PORT),
      });
      const freshAuth = new AuthService(prisma, jwtService, configService, freshRedis);
      try {
        await expect(
          freshAuth.login({ email: TEST_EMAIL, password: 'right-password' }),
        ).rejects.toThrow(/locked/i);
      } finally {
        await freshRedis.quit();
      }
    });
  });
});
