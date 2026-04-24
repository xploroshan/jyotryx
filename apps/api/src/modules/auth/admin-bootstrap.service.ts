import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { Role, AuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

/**
 * Ensures a usable admin account exists on every boot.
 *
 * Context: the Docker image runs `prisma migrate deploy` on start but
 * never runs `prisma/seed.ts`, so deployments that didn't manually
 * execute `npm run seed` end up with no admin user at all — the
 * `admin@jyotron.com` login from the docs just fails with "Invalid
 * email or password". This service closes that gap idempotently:
 *
 * 1. If no user with role=ADMIN exists, create one using
 *    ADMIN_EMAIL + ADMIN_PASSWORD env vars (sensible dev defaults
 *    when NODE_ENV !== 'production').
 * 2. If ADMIN_BOOTSTRAP_RESET=true, reset the seeded admin's password
 *    to ADMIN_PASSWORD and clear any login-failure locks in Redis.
 *    Useful for ops recovery without shelling into psql.
 *
 * In production the service refuses to create an admin unless
 * ADMIN_EMAIL + ADMIN_PASSWORD are both explicitly set — we never
 * silently install a weak default credential on a real deployment.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureAdmin();
    } catch (err) {
      // Failing to bootstrap admin must NOT crash the API — the rest
      // of the app can still serve authenticated users. Surface the
      // error loudly so ops can act.
      this.logger.error(
        'Admin bootstrap failed; login for the default admin may not work',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async ensureAdmin(): Promise<void> {
    const env = this.config.get<string>('NODE_ENV') ?? 'development';
    const isProd = env === 'production';

    const email = this.config.get<string>('ADMIN_EMAIL') ?? 'admin@jyotron.com';
    const configuredPassword = this.config.get<string>('ADMIN_PASSWORD');
    const resetRequested =
      (this.config.get<string>('ADMIN_BOOTSTRAP_RESET') ?? '').toLowerCase() ===
      'true';

    // In prod we refuse to invent a default password; the deployment
    // must set ADMIN_PASSWORD explicitly or run the seed manually.
    if (isProd && !configuredPassword) {
      this.logger.warn(
        `ADMIN_PASSWORD not set in production — skipping admin bootstrap. Set ADMIN_EMAIL + ADMIN_PASSWORD env vars or run 'npm run seed' once.`,
      );
      return;
    }

    const password = configuredPassword ?? 'admin@jyotron2024';

    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      await this.prisma.user.create({
        data: {
          email,
          name: 'Jyotron Admin',
          passwordHash,
          role: Role.ADMIN,
          credits: 9999,
          provider: AuthProvider.LOCAL,
          preferredLanguage: 'en',
        },
      });
      this.logger.log(
        `Seeded initial admin account: ${email}${configuredPassword ? '' : ' (default password — rotate immediately via ADMIN_PASSWORD env var)'}`,
      );
      await this.clearLoginLocks(email);
      return;
    }

    // Admin row already exists. Two follow-up concerns:
    //   (a) it might have been created without a password (e.g. OTP
    //       flow), which makes email login permanently broken — so
    //       backfill passwordHash + role if missing.
    //   (b) ops explicitly asked for a reset.
    const needsPasswordBackfill = !existing.passwordHash;
    const needsRoleFix = existing.role !== Role.ADMIN;

    if (resetRequested || needsPasswordBackfill || needsRoleFix) {
      const passwordHash = await bcrypt.hash(password, 12);
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: Role.ADMIN,
          provider: AuthProvider.LOCAL,
        },
      });
      await this.clearLoginLocks(email);
      this.logger.log(
        `Admin account ${email} updated (reset=${resetRequested}, passwordBackfill=${needsPasswordBackfill}, roleFix=${needsRoleFix}).`,
      );
    }
  }

  /**
   * Failed-login rate limiting is Redis-backed (`login:fail:<email>`
   * and `login:lock:<email>` keys, 15-minute TTL). When ops resets
   * the admin we also clear these so the next login attempt isn't
   * rejected by a leftover lockout.
   */
  private async clearLoginLocks(email: string): Promise<void> {
    try {
      await this.redis.del(`login:fail:${email}`, `login:lock:${email}`);
    } catch (err) {
      this.logger.warn(
        `Could not clear login locks for ${email}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
