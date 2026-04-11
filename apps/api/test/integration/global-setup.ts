import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { startRedis } from './infra/redis-server';
import { startPostgres } from './infra/postgres-server';
import { startPgBouncer } from './infra/pgbouncer-server';

/**
 * Jest globalSetup for the integration suite.
 *
 * Spins up three real daemons on random ports (redis-server, postgres,
 * pgbouncer), runs `prisma migrate deploy` against the fresh database,
 * and writes a JSON handoff file that the teardown hook uses to stop
 * them. Tests read coordinates via `process.env`.
 *
 * Skips itself quietly if the three binaries aren't available — useful
 * for contributors who want to run other suites without installing
 * postgres/pgbouncer locally.
 */
export default async function globalSetup(): Promise<void> {
  const startedAt = Date.now();

  const redis = await startRedis();
  process.env.TEST_REDIS_HOST = redis.host;
  process.env.TEST_REDIS_PORT = String(redis.port);
  process.env.TEST_REDIS_URL = redis.url;

  const postgres = await startPostgres();
  process.env.TEST_POSTGRES_URL = postgres.url;
  process.env.TEST_POSTGRES_HOST = postgres.host;
  process.env.TEST_POSTGRES_PORT = String(postgres.port);
  process.env.TEST_POSTGRES_USER = postgres.user;
  process.env.TEST_POSTGRES_PASSWORD = postgres.password;
  process.env.TEST_POSTGRES_DB = postgres.database;

  // Run migrations against the fresh cluster.
  const apiDir = path.resolve(__dirname, '..', '..');
  const migrate = spawnSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    {
      cwd: apiDir,
      env: { ...process.env, DATABASE_URL: postgres.url },
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );
  if (migrate.status !== 0) {
    await redis.stop();
    await postgres.stop();
    throw new Error(
      `prisma migrate deploy failed (code ${migrate.status}):\n${migrate.stderr || migrate.stdout}`,
    );
  }

  // Now layer pgBouncer on top with a deliberately small pool so tests
  // can exercise exhaustion behavior.
  const pgb = await startPgBouncer({
    upstream: {
      host: postgres.host,
      port: postgres.port,
      database: postgres.database,
      user: postgres.user,
      password: postgres.password,
    },
    poolSize: 5,
    maxClientConn: 50,
    poolMode: 'transaction',
  });
  process.env.TEST_PGBOUNCER_URL = `${pgb.url}?pgbouncer=true&connection_limit=5&pool_timeout=10`;
  process.env.TEST_PGBOUNCER_HOST = pgb.host;
  process.env.TEST_PGBOUNCER_PORT = String(pgb.port);

  // Stash coordinates on disk so the teardown worker can shut everything
  // down without relying on in-process state (globalSetup runs in its
  // own node process, separate from test workers).
  const handoff = {
    redis: { host: redis.host, port: redis.port },
    postgres: {
      host: postgres.host,
      port: postgres.port,
      user: postgres.user,
      password: postgres.password,
      database: postgres.database,
      dataDir: postgres.dataDir,
    },
    pgbouncer: { host: pgb.host, port: pgb.port },
    pidHints: {
      // Record the dataDir + ini path so teardown can pg_ctl stop / SIGTERM
      // even if the parent spawn handles have been GC'd.
      postgresDataDir: postgres.dataDir,
    },
  };
  const handoffPath = path.join(
    require('os').tmpdir(),
    `jyotryx-int-handoff-${process.pid}.json`,
  );
  fs.writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));
  process.env.JYOTRYX_INT_HANDOFF = handoffPath;

  // Retain the stop closures on the module-level global so teardown can
  // reach them. Jest shares `globalThis` between globalSetup and
  // globalTeardown when they run in the same node process.
  (globalThis as any).__JYOTRYX_INT__ = { redis, postgres, pgb };

  // Small log to confirm boot time in CI diagnostics.
  // eslint-disable-next-line no-console
  console.log(
    `[int-setup] redis=${redis.port} postgres=${postgres.port} pgbouncer=${pgb.port} ` +
      `boot_ms=${Date.now() - startedAt}`,
  );
}
