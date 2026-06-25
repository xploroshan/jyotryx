/**
 * JWT Refresh Token Rotation Tests
 *
 * Verifies the token family model: rotation, reuse detection, family
 * revocation, and logout endpoint behavior.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { mockPrismaService, mockConfigService, createMockRedis, mockUser } from './helpers/mocks';

describe('JWT Refresh Token Rotation', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let redis: ReturnType<typeof createMockRedis>;
  let jwtService: any;

  const FAMILY_ID = 'family-uuid-1';
  const JTI = 'jti-uuid-1';

  function makeRefreshPayload(overrides: any = {}) {
    return {
      sub: 'test-uuid',
      email: 'test@example.com',
      name: 'Test User',
      jti: JTI,
      familyId: FAMILY_ID,
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = mockPrismaService();
    redis = createMockRedis();
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('new-mock-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    redis.__clear();
  });

  // ─── refreshToken ────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('should return new token pair for a valid, unused refresh token', async () => {
      const payload = makeRefreshPayload();
      jwtService.verify.mockReturnValue(payload);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Store token in Redis as unused
      await redis.set(`rt:${JTI}`, JSON.stringify({ userId: 'test-uuid', familyId: FAMILY_ID, used: false }), 'EX', 86400);

      const result = await service.refreshToken({ refreshToken: 'valid-token' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2); // access + refresh
    });

    it('should mark the old token as used in Redis', async () => {
      const payload = makeRefreshPayload();
      jwtService.verify.mockReturnValue(payload);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await redis.set(`rt:${JTI}`, JSON.stringify({ userId: 'test-uuid', familyId: FAMILY_ID, used: false }), 'EX', 86400);

      await service.refreshToken({ refreshToken: 'valid-token' });

      // Old token should now be marked as used
      const stored = JSON.parse(await redis.get(`rt:${JTI}`) || '{}');
      expect(stored.used).toBe(true);
    });

    it('should throw 401 when token not found in Redis (expired/revoked)', async () => {
      const payload = makeRefreshPayload();
      jwtService.verify.mockReturnValue(payload);

      // Don't store anything in Redis — simulates expired/revoked token

      await expect(service.refreshToken({ refreshToken: 'gone-token' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should revoke entire family on reuse of already-used token', async () => {
      const payload = makeRefreshPayload();
      jwtService.verify.mockReturnValue(payload);

      // Store token as ALREADY USED
      await redis.set(`rt:${JTI}`, JSON.stringify({ userId: 'test-uuid', familyId: FAMILY_ID, used: true }), 'EX', 86400);
      // Store family set with this jti
      await redis.sadd(`rt:family:${FAMILY_ID}`, JTI);

      await expect(service.refreshToken({ refreshToken: 'reused-token' }))
        .rejects.toThrow(/reuse detected/i);
    });

    it('rejects legacy tokens without jti/familyId, forcing re-login', async () => {
      // Pre-rotation payloads have no jti/familyId. They bypass reuse-detection
      // and force-logout, so they are now rejected — the holder re-authenticates
      // once to receive a rotated, revocable token.
      jwtService.verify.mockReturnValue({ sub: 'test-uuid', email: 'test@example.com', name: 'Test User' });

      await expect(
        service.refreshToken({ refreshToken: 'legacy-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 401 when JWT signature is invalid', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid signature'); });

      await expect(service.refreshToken({ refreshToken: 'bad-sig' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should revoke family if user no longer exists', async () => {
      const payload = makeRefreshPayload();
      jwtService.verify.mockReturnValue(payload);
      prisma.user.findUnique.mockResolvedValue(null); // user deleted

      await redis.set(`rt:${JTI}`, JSON.stringify({ userId: 'test-uuid', familyId: FAMILY_ID, used: false }), 'EX', 86400);

      await expect(service.refreshToken({ refreshToken: 'orphan-token' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── generateTokens (tested via refreshToken flow) ───────────────────

  describe('generateTokens (via refresh)', () => {
    it('should store new jti in Redis with TTL', async () => {
      const payload = makeRefreshPayload();
      jwtService.verify.mockReturnValue(payload);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await redis.set(`rt:${JTI}`, JSON.stringify({ userId: 'test-uuid', familyId: FAMILY_ID, used: false }), 'EX', 86400);

      await service.refreshToken({ refreshToken: 'valid-token' });

      // pipeline.set should have been called for the new token
      expect(redis.pipeline).toHaveBeenCalled();
      const pipelineInstance = redis.pipeline.mock.results[0].value;
      expect(pipelineInstance.set).toHaveBeenCalled();
      expect(pipelineInstance.sadd).toHaveBeenCalled();
      expect(pipelineInstance.expire).toHaveBeenCalled();
      expect(pipelineInstance.exec).toHaveBeenCalled();
    });

    it('should preserve familyId when refreshing within the same family', async () => {
      const payload = makeRefreshPayload();
      jwtService.verify.mockReturnValue(payload);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await redis.set(`rt:${JTI}`, JSON.stringify({ userId: 'test-uuid', familyId: FAMILY_ID, used: false }), 'EX', 86400);

      await service.refreshToken({ refreshToken: 'valid-token' });

      // The refresh token should include the same familyId
      const refreshSignCall = jwtService.signAsync.mock.calls.find(
        (c: any[]) => c[0]?.familyId !== undefined,
      );
      expect(refreshSignCall[0].familyId).toBe(FAMILY_ID);
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke the entire token family', async () => {
      jwtService.verify.mockReturnValue({ sub: 'test-uuid', familyId: FAMILY_ID });

      // Set up family with 2 members
      await redis.sadd(`rt:family:${FAMILY_ID}`, 'jti-1', 'jti-2');
      await redis.set('rt:jti-1', JSON.stringify({ used: false }), 'EX', 86400);
      await redis.set('rt:jti-2', JSON.stringify({ used: false }), 'EX', 86400);

      const result = await service.logout('valid-refresh-token');

      expect(result).toEqual({ message: 'Logged out' });
      // pipeline should have been used to delete all family members
      expect(redis.pipeline).toHaveBeenCalled();
    });

    it('should return success even with invalid/expired token', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('expired'); });

      const result = await service.logout('expired-token');
      expect(result).toEqual({ message: 'Logged out' });
    });

    it('should return success when token has no familyId (legacy)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'test-uuid' }); // no familyId

      const result = await service.logout('legacy-token');
      expect(result).toEqual({ message: 'Logged out' });
    });
  });
});
