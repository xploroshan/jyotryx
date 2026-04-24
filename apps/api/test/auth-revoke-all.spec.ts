/**
 * Phase 3 force-logout primitive: AuthService.revokeAllUserTokens().
 *
 * The test scrubs a fake Redis with the exact key layout documented
 * in auth.service.ts:
 *   rt:{jti}                — per-token metadata
 *   rt:family:{familyId}    — set of JTIs in that family
 *   rt:user-families:{uid}  — set of family ids for a user
 *
 * After revokeAllUserTokens(), every `rt:{jti}` member of every family
 * in the user set is gone, along with the family sets themselves and
 * the reverse index. Sessions belonging to *other* users must be
 * untouched — that's the blast-radius invariant worth pinning.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createMockRedis } from './helpers/mocks';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';

describe('AuthService.revokeAllUserTokens', () => {
  let service: AuthService;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    redis = createMockRedis();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: JwtService, useValue: { signAsync: jest.fn(), verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, fb?: any) => (k === 'jwt.refreshExpiresIn' ? '30d' : fb)),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  async function seedSession(userId: string, familyId: string, jtis: string[]) {
    for (const jti of jtis) {
      await redis.set(`rt:${jti}`, JSON.stringify({ userId, familyId, used: false }), 'EX', 3600);
    }
    await redis.sadd(`rt:family:${familyId}`, ...jtis);
    await redis.sadd(`rt:user-families:${userId}`, familyId);
  }

  it('revokes every family belonging to a user without touching other users', async () => {
    // User A has two families (two browser logins + a refresh in one).
    await seedSession('user-a', 'fam-a1', ['jti-1', 'jti-2']);
    await seedSession('user-a', 'fam-a2', ['jti-3']);
    // User B has a separate session.
    await seedSession('user-b', 'fam-b1', ['jti-4']);

    const res = await service.revokeAllUserTokens('user-a');

    expect(res.familiesRevoked).toBe(2);
    // Every `rt:jti-*` for user A is gone
    expect(await redis.get('rt:jti-1')).toBeNull();
    expect(await redis.get('rt:jti-2')).toBeNull();
    expect(await redis.get('rt:jti-3')).toBeNull();
    // Family sets are gone
    expect(redis.__store.has('rt:family:fam-a1')).toBe(false);
    expect(redis.__store.has('rt:family:fam-a2')).toBe(false);
    // Reverse index is gone
    expect(redis.__store.has('rt:user-families:user-a')).toBe(false);
    // User B's session survives — blast-radius invariant
    expect(await redis.get('rt:jti-4')).toBeTruthy();
    expect(redis.__store.has('rt:family:fam-b1')).toBe(true);
  });

  it('is a no-op when the user has no active families', async () => {
    const res = await service.revokeAllUserTokens('never-logged-in');
    expect(res.familiesRevoked).toBe(0);
  });
});
