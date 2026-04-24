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
    expect(created.email).toBe('admin@jyotron.com');
    expect(created.role).toBe('ADMIN');
    expect(created.passwordHash).toBeDefined();
    // Default password hashes to the value the docs advertise.
    const match = await bcrypt.compare('admin@jyotron2024', created.passwordHash);
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
      email: 'admin@jyotron.com',
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
    const match = await bcrypt.compare('admin@jyotron2024', update.data.passwordHash);
    expect(match).toBe(true);
  });

  it('fixes role when admin email exists as USER (someone signed up first)', async () => {
    const prisma = makePrismaMock({
      id: 'u-1',
      email: 'admin@jyotron.com',
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
      email: 'admin@jyotron.com',
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
      'login:fail:admin@jyotron.com',
      'login:lock:admin@jyotron.com',
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
