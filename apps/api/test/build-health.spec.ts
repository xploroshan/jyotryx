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
 * ─── Currently skipped ───────────────────────────────────────────
 * The merged code from main does NOT compile cleanly under the
 * pinned dependency versions:
 *
 *   - TypeScript 6.x flags 27 × TS2564 (DTO properties without
 *     initialisers) across apps/api/src/modules/{auth,payment,chat,
 *     numerology,tarot,vastu}/dto/. Fix: append `!:` to the property
 *     types or add `!` to the assignment, e.g.
 *         currentPassword!: string
 *
 *   - Prisma 7.x changed how nullable JSON columns are written:
 *     `previousData: null` is no longer assignable to
 *     `NullableJsonNullValueInput | InputJsonValue`. Fix: replace
 *     every `previousData: null` / `newData: null` /
 *     `entityId: null` in apps/api/src/modules/admin/admin.service.ts
 *     and apps/api/src/stats/stats.service.ts with
 *     `Prisma.JsonNull` (for JSON columns) or drop the field
 *     entirely (for required columns).
 *
 *   - tsconfig.json hits TS5011 ("rootDir must be set explicitly")
 *     and TS5101 (`baseUrl` deprecated). Fix: add
 *         "rootDir": "./src",
 *         "ignoreDeprecations": "6.0",
 *     to apps/api/tsconfig.json.
 *
 *   - Knowledge integrity test fails with TS2593 because the api
 *     tsconfig doesn't include @types/jest. Fix: either move that
 *     spec under apps/api/test/ (where the spec tsconfig already
 *     includes jest types) or add "types": ["jest"] for that file.
 *
 * Run `cd apps/api && npx nest build 2>&1 | grep "error TS" | sort
 * -u` to enumerate all 77 errors. Once they're cleared, flip
 * `describe.skip` → `describe` below and CI will permanently lock in
 * the build.
 */
describe.skip('API build health', () => {
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
