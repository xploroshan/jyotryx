/**
 * AdminBootstrapService — verifies that:
 *  - a fresh database gets a seeded ADMIN user on boot;
 *  - an existing admin row without a password gets backfilled
 *    (matches the real production case where an admin was created via
 *    OTP and then couldn't log in with email);
 *  - ADMIN_BOOTSTRAP_RESET=true re-hashes the password and clears any
 *    Redis-backed lockout;
 *  - production refuses to install the default password.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AdminBootstrapService } from '../src/modules/auth/admin-bootstrap.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';

// Typed-loose helpers: the prisma user model has many fields we don't
// care about here; test doubles just need a permissive shape.
type AnyPrisma = any;
type AnyRedis = any;

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function makePrismaMock(existing: any = null): AnyPrisma {
  const user = {
    findUnique: (jest as any).fn().mockResolvedValue(existing),
    create: (jest as any)
      .fn()
      .mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'new-id', ...data }),
      ),
    update: (jest as any)
      .fn()
      .mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: existing?.id ?? 'x', ...existing, ...data }),
      ),
  };
  return { user };
}

function makeRedisMock(): AnyRedis {
  return { del: (jest as any).fn().mockResolvedValue(1) };
}

async function buildService(opts: {
  config: ConfigService;
  prisma: AnyPrisma;
  redis: AnyRedis;
}): Promise<AdminBootstrapService> {
  const mod: TestingModule = await Test.createTestingModule({
    providers: [
      AdminBootstrapService,
      { provide: PrismaService, useValue: opts.prisma },
      { provide: ConfigService, useValue: opts.config },
      { provide: REDIS_CLIENT, useValue: opts.redis },
    ],
  }).compile();
  return mod.get(AdminBootstrapService);
}

describe('AdminBootstrapService', () => {
  it('creates the admin when none exists (dev default)', async () => {
    const prisma = makePrismaMock(null);
    const redis = makeRedisMock();
    const config = makeConfig({ NODE_ENV: 'development' });
    const svc = await buildService({ prisma, redis, config });

    await svc.onApplicationBootstrap();

    expect((prisma.user.create as any)).toHaveBeenCalledTimes(1);
    const created = (prisma.user.create as any).mock.calls[0][0].data;
    expect(created.email).toBe('admin@myastro360.com');
    expect(created.role).toBe('ADMIN');
    expect(created.passwordHash).toBeDefined();
    // Default password hashes to the value the docs advertise.
    const match = await bcrypt.compare('admin@myastro360_2024', created.passwordHash);
    expect(match).toBe(true);
    expect(redis.del).toHaveBeenCalled();
  });

  it('respects ADMIN_EMAIL / ADMIN_PASSWORD overrides', async () => {
    const prisma = makePrismaMock(null);
    const redis = makeRedisMock();
    const config = makeConfig({
      NODE_ENV: 'development',
      ADMIN_EMAIL: 'ops@example.com',
      ADMIN_PASSWORD: 'correct horse battery staple',
    });
    const svc = await buildService({ prisma, redis, config });

    await svc.onApplicationBootstrap();

    const created = (prisma.user.create as any).mock.calls[0][0].data;
    expect(created.email).toBe('ops@example.com');
    const match = await bcrypt.compare('correct horse battery staple', created.passwordHash);
    expect(match).toBe(true);
  });

  it('backfills passwordHash when the admin exists but has no password (OTP-only account)', async () => {
    const prisma = makePrismaMock({
      id: 'admin-1',
      email: 'admin@myastro360.com',
      passwordHash: null,
      role: 'ADMIN',
    });
    const redis = makeRedisMock();
    const config = makeConfig({ NODE_ENV: 'development' });
    const svc = await buildService({ prisma, redis, config });

    await svc.onApplicationBootstrap();

    expect((prisma.user.update as any)).toHaveBeenCalledTimes(1);
    const update = (prisma.user.update as any).mock.calls[0][0];
    expect(update.where.id).toBe('admin-1');
    expect(update.data.passwordHash).toBeDefined();
    const match = await bcrypt.compare('admin@myastro360_2024', update.data.passwordHash);
    expect(match).toBe(true);
  });

  it('fixes role when admin email exists as USER (someone signed up first)', async () => {
    const prisma = makePrismaMock({
      id: 'u-1',
      email: 'admin@myastro360.com',
      passwordHash: 'existing-hash',
      role: 'USER',
    });
    const redis = makeRedisMock();
    const config = makeConfig({ NODE_ENV: 'development' });
    const svc = await buildService({ prisma, redis, config });

    await svc.onApplicationBootstrap();

    const update = (prisma.user.update as any).mock.calls[0][0];
    expect(update.data.role).toBe('ADMIN');
  });

  it('resets the password and clears Redis locks when ADMIN_BOOTSTRAP_RESET=true', async () => {
    const prisma = makePrismaMock({
      id: 'admin-1',
      email: 'admin@myastro360.com',
      passwordHash: 'stale-hash',
      role: 'ADMIN',
    });
    const redis = makeRedisMock();
    const config = makeConfig({
      NODE_ENV: 'development',
      ADMIN_BOOTSTRAP_RESET: 'true',
      ADMIN_PASSWORD: 'recovered-pass-1',
    });
    const svc = await buildService({ prisma, redis, config });

    await svc.onApplicationBootstrap();

    const update = (prisma.user.update as any).mock.calls[0][0];
    expect(update.data.passwordHash).toBeDefined();
    expect(update.data.passwordHash).not.toBe('stale-hash');
    const match = await bcrypt.compare('recovered-pass-1', update.data.passwordHash);
    expect(match).toBe(true);
    expect(redis.del).toHaveBeenCalledWith(
      'login:fail:admin@myastro360.com',
      'login:lock:admin@myastro360.com',
    );
  });

  it('is a no-op in production without ADMIN_PASSWORD', async () => {
    const prisma = makePrismaMock(null);
    const redis = makeRedisMock();
    const config = makeConfig({ NODE_ENV: 'production' });
    const svc = await buildService({ prisma, redis, config });

    await svc.onApplicationBootstrap();

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('creates the admin in production when ADMIN_PASSWORD is explicit', async () => {
    const prisma = makePrismaMock(null);
    const redis = makeRedisMock();
    const config = makeConfig({
      NODE_ENV: 'production',
      ADMIN_EMAIL: 'ops@example.com',
      ADMIN_PASSWORD: 'strong-prod-password-123',
    });
    const svc = await buildService({ prisma, redis, config });

    await svc.onApplicationBootstrap();

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  describe('ADMIN_PROMOTE_EMAILS', () => {
    function makeMultiUserPrisma(usersByEmail: Record<string, any>): AnyPrisma {
      return {
        user: {
          findUnique: (jest as any)
            .fn()
            .mockImplementation(({ where }: { where: { email?: string } }) =>
              Promise.resolve(
                where.email ? usersByEmail[where.email.toLowerCase()] ?? null : null,
              ),
            ),
          create: (jest as any)
            .fn()
            .mockImplementation(({ data }: { data: any }) =>
              Promise.resolve({ id: 'new-id', ...data }),
            ),
          update: (jest as any)
            .fn()
            .mockImplementation(({ where, data }: { where: any; data: any }) =>
              Promise.resolve({ id: where.id, ...data }),
            ),
        },
      };
    }

    it('promotes a registered non-admin user to ADMIN', async () => {
      const prisma = makeMultiUserPrisma({
        // Default admin already fine — skip the ensureAdmin update path.
        'admin@myastro360.com': {
          id: 'admin-1',
          email: 'admin@myastro360.com',
          passwordHash: 'x',
          role: 'ADMIN',
        },
        'myastro360.astro@gmail.com': {
          id: 'u-42',
          email: 'myastro360.astro@gmail.com',
          passwordHash: 'y',
          role: 'USER',
        },
      });
      const redis = makeRedisMock();
      const config = makeConfig({
        NODE_ENV: 'development',
        ADMIN_PROMOTE_EMAILS: 'myastro360.astro@gmail.com',
      });
      const svc = await buildService({ prisma, redis, config });

      await svc.onApplicationBootstrap();

      const updates = (prisma.user.update as any).mock.calls.filter(
        (c: any[]) => c[0]?.where?.id === 'u-42',
      );
      expect(updates).toHaveLength(1);
      expect(updates[0][0].data).toEqual({ role: 'ADMIN' });
    });

    it('accepts a comma-separated list and is case-insensitive', async () => {
      const prisma = makeMultiUserPrisma({
        'admin@myastro360.com': { id: 'a', email: 'admin@myastro360.com', passwordHash: 'x', role: 'ADMIN' },
        'alice@x.com': { id: 'u-1', email: 'alice@x.com', passwordHash: 'x', role: 'USER' },
        'bob@y.com': { id: 'u-2', email: 'bob@y.com', passwordHash: 'x', role: 'USER' },
      });
      const redis = makeRedisMock();
      const config = makeConfig({
        NODE_ENV: 'development',
        ADMIN_PROMOTE_EMAILS: '  Alice@X.com , bob@y.com ',
      });
      const svc = await buildService({ prisma, redis, config });

      await svc.onApplicationBootstrap();

      const promoted = (prisma.user.update as any).mock.calls
        .filter((c: any[]) => c[0]?.data?.role === 'ADMIN' && c[0]?.where?.id?.startsWith('u-'))
        .map((c: any[]) => c[0].where.id);
      expect(promoted.sort()).toEqual(['u-1', 'u-2']);
    });

    it('is idempotent for already-ADMIN users', async () => {
      const prisma = makeMultiUserPrisma({
        'admin@myastro360.com': { id: 'a', email: 'admin@myastro360.com', passwordHash: 'x', role: 'ADMIN' },
        'already@x.com': { id: 'u-1', email: 'already@x.com', passwordHash: 'x', role: 'ADMIN' },
      });
      const redis = makeRedisMock();
      const config = makeConfig({
        NODE_ENV: 'development',
        ADMIN_PROMOTE_EMAILS: 'already@x.com',
      });
      const svc = await buildService({ prisma, redis, config });

      await svc.onApplicationBootstrap();

      const promotions = (prisma.user.update as any).mock.calls.filter(
        (c: any[]) => c[0]?.where?.id === 'u-1',
      );
      expect(promotions).toHaveLength(0);
    });

    it('does not throw when the target email is not yet registered', async () => {
      const prisma = makeMultiUserPrisma({
        'admin@myastro360.com': { id: 'a', email: 'admin@myastro360.com', passwordHash: 'x', role: 'ADMIN' },
      });
      const redis = makeRedisMock();
      const config = makeConfig({
        NODE_ENV: 'development',
        ADMIN_PROMOTE_EMAILS: 'not-yet@example.com',
      });
      const svc = await buildService({ prisma, redis, config });

      await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
      // Nothing to promote → no update call against a missing user.
      const badUpdates = (prisma.user.update as any).mock.calls.filter(
        (c: any[]) => c[0]?.data?.role === 'ADMIN' && c[0]?.where?.id?.startsWith('u-'),
      );
      expect(badUpdates).toHaveLength(0);
    });

    it('runs even when ensureAdmin fails (no cascading skip)', async () => {
      // Admin lookup throws, but we still want the promote list to be
      // honoured — operators rely on the promote flow as an emergency
      // access-restoration path.
      const prisma: AnyPrisma = {
        user: {
          findUnique: (jest as any)
            .fn()
            .mockImplementationOnce(() => Promise.reject(new Error('timeout')))
            .mockImplementation(({ where }: { where: { email?: string } }) =>
              Promise.resolve(
                where.email === 'target@x.com'
                  ? { id: 'u-9', email: 'target@x.com', passwordHash: 'x', role: 'USER' }
                  : null,
              ),
            ),
          update: (jest as any).fn().mockResolvedValue({}),
          create: (jest as any).fn(),
        },
      };
      const redis = makeRedisMock();
      const config = makeConfig({
        NODE_ENV: 'development',
        ADMIN_PROMOTE_EMAILS: 'target@x.com',
      });
      const svc = await buildService({ prisma, redis, config });

      await svc.onApplicationBootstrap();

      const promoted = (prisma.user.update as any).mock.calls.find(
        (c: any[]) => c[0]?.where?.id === 'u-9',
      );
      expect(promoted).toBeDefined();
      expect(promoted[0].data).toEqual({ role: 'ADMIN' });
    });
  });

  it('does not crash the app if Prisma throws', async () => {
    const prisma: AnyPrisma = {
      user: {
        findUnique: (jest as any).fn().mockRejectedValue(new Error('db down')),
      },
    };
    const redis = makeRedisMock();
    const config = makeConfig({ NODE_ENV: 'development' });
    const svc = await buildService({ prisma, redis, config });

    // Should resolve, not throw.
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
