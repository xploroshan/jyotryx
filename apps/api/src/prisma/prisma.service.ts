import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Prisma 7 dropped the binary engine, so the runtime client now
    // talks to Postgres via a driver adapter. `main.ts` already
    // normalised `DATABASE_URL` (sslmode, pgbouncer params) before the
    // DI container booted, so we just hand the connection string to
    // PrismaPg here and let it manage its own pool.
    //
    // We strip `sslmode=` from the URL before handing it to PrismaPg
    // and pass `ssl: { rejectUnauthorized: false }` explicitly. The
    // explicit option is necessary because Supabase's CA isn't in
    // Node's default trust store and pg would otherwise fail every
    // query with "self-signed certificate in certificate chain". The
    // strip is necessary because of a precedence bug in
    // `pg/lib/connection-parameters.js`:
    //   config = Object.assign({}, config, parse(connectionString))
    // The URL-parsed config OVERRIDES the explicit one, so leaving
    // `sslmode=require` in the URL silently wipes our `ssl` override
    // and pg falls back to verify-full. We strip only for the runtime
    // adapter; the original DATABASE_URL keeps `sslmode=require`,
    // which `prisma migrate deploy` (libpq-style) needs intact.
    super({
      adapter: new PrismaPg({
        connectionString: PrismaService.stripSslmode(process.env.DATABASE_URL),
        // TLS only when the target actually supports it. Managed Postgres
        // (production / any URL that asked for sslmode) needs it with relaxed
        // verification (Supabase's CA isn't in Node's trust store). A local or
        // CI-spawned postgres has SSL OFF, and forcing `ssl` there makes pg
        // throw "The server does not support SSL connections" on every query —
        // which broke the entire integration suite.
        ssl: PrismaService.wantsSsl(process.env.DATABASE_URL)
          ? { rejectUnauthorized: false }
          : false,
      }),
    });
  }

  /**
   * Whether the runtime adapter should negotiate TLS. True in production
   * (managed PG requires it) or whenever the connection string explicitly
   * asked for SSL via `sslmode`. False for a plain local/CI postgres, which
   * has no SSL — forcing it there fails every query.
   */
  static wantsSsl(input: string | undefined): boolean {
    if (process.env.NODE_ENV === 'production') return true;
    if (!input) return false;
    return /[?&]sslmode=(require|prefer|verify-ca|verify-full)/i.test(input);
  }

  /**
   * Remove `sslmode` from the connection-string query so the URL parsed
   * by pg doesn't override the explicit `ssl` option we pass alongside
   * the `connectionString`. See the constructor comment for the full
   * explanation.
   */
  static stripSslmode(input: string | undefined): string {
    if (!input) return '';
    try {
      const u = new URL(input);
      u.searchParams.delete('sslmode');
      return u.toString();
    } catch {
      return input;
    }
  }

  /**
   * Normalize DATABASE_URL for production runtime use:
   *  1. Append `sslmode=require` when missing (managed PG requires TLS).
   *  2. Append `pgbouncer=true` when the host is a PgBouncer pooler
   *     (Supabase `*.pooler.supabase.com`, or any URL that already hints at
   *     `pgbouncer`). PgBouncer in transaction mode — and Supabase's session
   *     pooler under load — cannot safely reuse server-side prepared
   *     statements across checkouts, which surfaces as:
   *        `42P05: prepared statement "sN" already exists`
   *     Setting `pgbouncer=true` tells Prisma to stop issuing named
   *     prepared statements, which fixes `$queryRaw` / `$executeRaw`
   *     healthchecks and normal queries alike.
   *
   * We intentionally do NOT force `connection_limit=1`: PgBouncer already
   * multiplexes, and a long-lived Railway process benefits from Prisma's
   * default pool sizing. Operators can still override via the URL.
   */
  static normalizeUrl(input: string): string {
    if (!input) return input;
    let url = input;
    const isProd = process.env.NODE_ENV === 'production';
    const isPooler =
      /\.pooler\.supabase\.com/i.test(url) || /pgbouncer/i.test(url);

    const append = (key: string, value: string) => {
      if (new RegExp(`[?&]${key}=`).test(url)) return;
      url += `${url.includes('?') ? '&' : '?'}${key}=${value}`;
    };

    if (isProd && !/[?&]sslmode=/.test(url)) {
      append('sslmode', 'require');
    }
    if (isPooler) {
      append('pgbouncer', 'true');
    }
    return url;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (error) {
      this.logger.error(`Database connection failed: ${error}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }
}
