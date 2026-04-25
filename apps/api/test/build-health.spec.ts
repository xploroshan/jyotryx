import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Build-health gate.
 *
 * Why this exists: the CI pipeline runs `npx nest build` as the
 * "Lint API" step. If the build fails — or worse, if a future change
 * to ci.yml causes it to be skipped — the API binary deployed to
 * Render or Fly will be the previous successful one. The frontend
 * meanwhile auto-deploys on every PR merge, so the production stack
 * silently desynchronises:
 *
 *    web (latest)  ── calls /admin/funnel, /admin/ops/queues …
 *    api (stale)   ── doesn't have those routes yet
 *    user        ── sees `Cannot GET /api/admin/funnel` (Express 404)
 *
 * This test runs `nest build` inside Jest with a hard 5-minute cap.
 * A non-zero exit (TypeScript errors, missing dependencies, broken
 * decorators) fails the test, which fails CI, which blocks the merge
 * — making the deploy skew impossible at the source.
 *
 * The TS6 + Prisma 7 errors that originally kept this skipped were
 * cleared in the API build-restoration phases (tsconfig hygiene,
 * @nestjs/common single-tree, DTO `!:` markers, `Prisma.JsonNull`
 * semantics, and the residual spot fixes in PrismaService /
 * JwtStrategy / clickhouse-analytics stub). Keeping the gate active
 * from now on is what stops the silent deploy-skew door from
 * reopening.
 */
describe('API build health', () => {
  it('compiles cleanly via `nest build` (catches deploy-skew at PR time)', () => {
    const apiRoot = path.resolve(__dirname, '..');
    let stdout = '';
    let exitCode = 0;
    try {
      stdout = execSync('npx --no-install nest build', {
        cwd: apiRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5 * 60_000,
      });
    } catch (err: any) {
      exitCode = err.status ?? 1;
      // Combine stdout + stderr so the failure message in CI shows the
      // exact `error TSxxxx` lines that are blocking the build.
      stdout = `${err.stdout?.toString?.() ?? ''}\n${err.stderr?.toString?.() ?? ''}`;
    }
    if (exitCode !== 0) {
      const lastErrors = stdout
        .split('\n')
        .filter((l) => /error TS\d+|Cannot find/.test(l))
        .slice(0, 25)
        .join('\n');
      throw new Error(
        `nest build failed with exit ${exitCode}.\n` +
          `If this passes locally but fails in CI (or vice versa) check that\n` +
          `apps/api/node_modules is in sync — Prisma 7 + TypeScript 6 schema\n` +
          `or DTO changes are common culprits.\n\n` +
          `First few errors:\n${lastErrors}`,
      );
    }
    expect(exitCode).toBe(0);
  }, 6 * 60_000);
});
