import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Prisma 7 reads the connection URL from `process.env.DATABASE_URL`
    // directly; the URL is normalized once at process startup in
    // `main.ts` before this constructor runs, so no per-instance config
    // is needed here.
    super();
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
