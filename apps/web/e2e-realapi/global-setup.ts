import { spawn, spawnSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { FullConfig } from '@playwright/test';

// Reuse the integration suite's battle-tested daemon launchers so the
// real-API E2E boots the SAME Postgres/Redis primitives the API expects.
import { startRedis, RedisHandle } from '../../api/test/integration/infra/redis-server';
import { startPostgres, PostgresHandle } from '../../api/test/integration/infra/postgres-server';

/**
 * Full-stack real-API E2E orchestrator.
 *
 * Boots, on ephemeral ports, the WHOLE stack the way production runs it:
 *   1. Real Redis        (BullMQ disabled; reports run on the sync path)
 *   2. Real Postgres 16  (migrated + seeded)
 *   3. Real NestJS API   (dist/main, full DI container, real HTTP)
 *   4. (Playwright `webServer` boots the real Next.js app pointed at #3)
 *
 * External services (OpenAI/Firebase/Razorpay/S3) have no keys here, so the
 * app's built-in fallbacks engage: reports use the KB/template fallback,
 * phone auth uses the backend OTP path (OTP_EXPOSE_IN_RESPONSE=true so the
 * spec can read the code without real SMS). This is intentional — we're
 * validating OUR code and the frontend↔backend contract, not third parties.
 *
 * Coordinates are handed to the specs + the web server via a JSON file at
 * E2E_REALAPI_HANDOFF (and process.env), torn down in global-teardown.
 */

const HANDOFF = process.env.E2E_REALAPI_HANDOFF
  ?? path.join(os.tmpdir(), 'myastro360-e2e-realapi.json');

// __dirname = apps/web/e2e-realapi → up to repo apps/, then into api/.
const API_DIR = path.resolve(__dirname, '..', '..', 'api');


function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        // Any HTTP response (even 404) means the server is accepting
        // connections — that's all we need to know it's up.
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(attempt, 500);
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    attempt();
  });
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-console
  console.log('[e2e-realapi] booting real stack…');

  const redis: RedisHandle = await startRedis();
  const postgres: PostgresHandle = await startPostgres();

  // --- Migrate the fresh cluster ---
  const migrate = spawnSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    { cwd: API_DIR, env: { ...process.env, DATABASE_URL: postgres.url }, encoding: 'utf8', stdio: 'pipe' },
  );
  if (migrate.status !== 0) {
    await redis.stop(); await postgres.stop();
    throw new Error(`prisma migrate deploy failed:\n${migrate.stderr || migrate.stdout}`);
  }

  // --- Seed admin/demo users (idempotent SQL) ---
  const seedSql = path.join(API_DIR, 'prisma', 'seed-users.sql');
  if (fs.existsSync(seedSql)) {
    spawnSync('npx', ['prisma', 'db', 'execute', '--file', seedSql, '--schema', 'prisma/schema.prisma'],
      { cwd: API_DIR, env: { ...process.env, DATABASE_URL: postgres.url }, encoding: 'utf8', stdio: 'pipe' });
  }

  // --- Enable the master "free mode" switch ---
  // The paid features (Reports, Palmistry, Chat) are pay-to-unlock by default,
  // so a fresh phone user calling /reports/generate gets a 402. The reports
  // spec deliberately drives the *free* KB/template generation path (see its
  // header), so flip `feature.free_mode` on here — the operator-facing switch
  // FeatureAccessService.paidFeaturesFree() reads — to make report generation
  // free for everyone in the E2E run. Applied with psql straight against the
  // ephemeral cluster (the Prisma CLI resolves its datasource from
  // prisma.config.ts, not the --schema/DATABASE_URL we pass, so it can't be
  // pointed at this throwaway DB). Idempotent.
  const freeMode = spawnSync(
    'psql',
    [
      '-h', '127.0.0.1',
      '-p', String(postgres.port),
      '-U', postgres.user,
      '-d', postgres.database,
      '-v', 'ON_ERROR_STOP=1',
      '-c',
      `INSERT INTO site_settings (key, value, "updatedAt") ` +
        `VALUES ('feature.free_mode', 'true', NOW()) ` +
        `ON CONFLICT (key) DO UPDATE SET value = 'true', "updatedAt" = NOW();`,
    ],
    { env: { ...process.env, PGPASSWORD: postgres.password }, encoding: 'utf8', stdio: 'pipe' },
  );
  if (freeMode.status !== 0) {
    // eslint-disable-next-line no-console
    console.warn(`[e2e-realapi] free_mode seed failed:\n${freeMode.stderr || freeMode.stdout}`);
  }

  // --- Build the API (compile dist/main) unless already built ---
  // Skipped when dist/main.js exists (CI/dev pre-builds it) so the
  // webServer's startup window isn't consumed by a cold build. We compile
  // with `tsc --noEmitOnError false` rather than `nest build`: the app has
  // some pre-existing type errors in non-runtime paths, and nest build
  // (noEmitOnError) refuses to emit on those, while tsc-with-emit produces
  // a runnable dist. The runtime code itself is sound (the suite proves it).
  const mainJs = path.join(API_DIR, 'dist', 'main.js');
  if (!fs.existsSync(mainJs) || process.env.E2E_FORCE_API_BUILD === 'true') {
    // eslint-disable-next-line no-console
    console.log('[e2e-realapi] building API…');
    const build = spawnSync(
      'npx',
      ['tsc', '-p', 'tsconfig.json', '--noEmitOnError', 'false'],
      { cwd: API_DIR, encoding: 'utf8', stdio: 'pipe' },
    );
    if (!fs.existsSync(mainJs)) {
      await redis.stop(); await postgres.stop();
      throw new Error(`API build did not produce dist/main.js:\n${build.stderr || build.stdout}`);
    }
  }

  // --- Boot the real API server ---
  // Fixed port (not dynamic): Playwright evaluates its config — including
  // webServer.env which must point the web app at this API — BEFORE
  // global-setup runs, so the port has to be known up front. E2E_API_PORT
  // is set by the npm script / config; default 4110.
  const apiPort = Number(process.env.E2E_API_PORT || 4110);
  const apiEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(apiPort),
    DATABASE_URL: postgres.url,
    REDIS_URL: redis.url,
    // Deterministic JWT secrets for the run.
    JWT_SECRET: 'e2e-realapi-jwt-secret',
    JWT_REFRESH_SECRET: 'e2e-realapi-refresh-secret',
    // BullMQ off → reports generate synchronously (KB/template fallback,
    // no OpenAI key needed). This keeps generate→view→download deterministic.
    QUEUE_ENABLED: 'false',
    DISABLE_QUEUES: 'true',
    // Expose OTP in the /auth/otp/send response so the phone-login spec can
    // read the code without a real SMS provider.
    OTP_EXPOSE_IN_RESPONSE: 'true',
    // Disable rate limiting for the run: a real E2E legitimately calls
    // /auth/otp/send several times from one IP, which would otherwise 429.
    THROTTLE_DISABLED: 'true',
    // Allow the web app's origin through CORS (Playwright webServer port).
    CORS_ORIGINS: 'http://127.0.0.1:3110,http://localhost:3110',
    ENABLE_SWAGGER: 'false',
  };
  const api: ChildProcess = spawn('node', ['dist/main.js'], {
    cwd: API_DIR, env: apiEnv, stdio: 'pipe',
  });
  const apiLog = fs.createWriteStream(path.join(os.tmpdir(), 'myastro360-e2e-api.log'));
  api.stdout?.pipe(apiLog);
  api.stderr?.pipe(apiLog);

  try {
    await waitForHttp(`http://127.0.0.1:${apiPort}/api/health/live`, 90_000);
  } catch (e) {
    api.kill('SIGKILL'); await redis.stop(); await postgres.stop();
    const log = fs.existsSync(apiLog.path as string) ? fs.readFileSync(apiLog.path as string, 'utf8') : '';
    throw new Error(`API failed to come up on :${apiPort}\n--- api log ---\n${log.slice(-4000)}`);
  }

  // Hand coordinates to the web server (via env) and teardown (via file).
  const apiBase = `http://127.0.0.1:${apiPort}/api`;
  process.env.E2E_API_BASE = apiBase;
  process.env.E2E_API_PORT = String(apiPort);

  const handoff = {
    apiPid: api.pid,
    apiPort,
    apiBase,
    redisUrl: redis.url,
    postgresUrl: postgres.url,
    // teardown re-imports the stop fns by pid; we persist enough to kill.
    startedAt,
  };
  fs.writeFileSync(HANDOFF, JSON.stringify(handoff, null, 2));

  // Stash stop handles on globalThis so teardown (same process) can call them.
  (globalThis as any).__E2E_REALAPI__ = { api, redis, postgres };

  // eslint-disable-next-line no-console
  console.log(`[e2e-realapi] stack ready in ${Date.now() - startedAt}ms — API ${apiBase}`);
}
