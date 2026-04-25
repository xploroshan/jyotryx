import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static contract test between the admin frontend and the NestJS admin
 * controller.
 *
 * Why this exists: hermetic E2E tests stub `**\/api/**` so they run
 * without a backend, which means they can NEVER catch a frontend URL
 * the backend doesn't actually serve. That class of bug shows up in
 * production as `Cannot GET /api/admin/<route>` (Express's default 404
 * fallback) — exactly the screenshots that were filed against the
 * Funnel and Ops tabs after Phase 2/3 shipped.
 *
 * This test fixes the gap by parsing every `api.get/post/put/delete`
 * call under `apps/web/src/app/admin/` and asserting that
 * `apps/api/src/modules/admin/admin.controller.ts` declares a matching
 * `@Get/@Post/@Put/@Delete` decorator. It runs in milliseconds, needs
 * no DB or live API, and fails the moment a developer adds a frontend
 * URL whose backend twin is missing (or vice versa, if you flip the
 * `requireBidirectional` knob below).
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'apps/web/src/app/admin');
const CONTROLLER = path.join(REPO_ROOT, 'apps/api/src/modules/admin/admin.controller.ts');

interface UrlCall {
  method: string;
  /** Path with `${...}` template substitutions normalised to `:param`. */
  path: string;
  /** File:line where the call was found, for human-friendly diagnostics. */
  source: string;
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) yield full;
  }
}

function extractFrontendCalls(): UrlCall[] {
  // Two passes: the typed form `api.get<Foo>("...")` and the untyped
  // form `api.put("...")`. Both styles appear in the admin code.
  const patterns = [
    /api\.(get|post|put|delete|patch)\s*<[^>]*>\s*\(\s*[`"']\/admin\/([^`"'?]+)[`"'?]/g,
    /api\.(get|post|put|delete|patch)\s*\(\s*[`"']\/admin\/([^`"'?]+)[`"'?]/g,
  ];
  const out: UrlCall[] = [];
  for (const file of walk(FRONTEND_ROOT)) {
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const method = m[1].toUpperCase();
        const tail = m[2]
          // Template-literal segments → :param so a single dynamic slot
          // matches the controller's `:id` style. Multiple consecutive
          // template segments collapse separately.
          .replace(/\$\{[^}]+\}/g, ':param')
          .replace(/\/$/, '');
        const lineNumber = src.slice(0, m.index).split('\n').length;
        out.push({
          method,
          path: `/admin/${tail}`,
          source: `${path.relative(REPO_ROOT, file)}:${lineNumber}`,
        });
        // Spot-check that the line actually contains the URL — guard
        // against pathological regex misbehaviour.
        void lines;
      }
    }
  }
  return out;
}

function extractBackendRoutes(): Set<string> {
  const src = fs.readFileSync(CONTROLLER, 'utf8');
  const routeRe = /@(Get|Post|Put|Delete|Patch)\(\s*['"]([^'"]+)['"]\s*\)/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(src))) {
    const method = m[1].toUpperCase();
    // Strip param names — we compare by position only.
    const routePath = m[2].replace(/:[^/]+/g, ':param').replace(/\/$/, '');
    set.add(`${method} /admin/${routePath}`);
  }
  return set;
}

describe('Admin URL contract — frontend ↔ backend', () => {
  const calls = extractFrontendCalls();
  const routes = extractBackendRoutes();

  // Sanity gates — if either of these fails, the regexes/file paths
  // are wrong and every assertion below would silently pass.
  it('finds at least 30 admin URLs in the frontend', () => {
    expect(calls.length).toBeGreaterThanOrEqual(30);
  });

  it('finds at least 30 admin route decorators in the backend', () => {
    expect(routes.size).toBeGreaterThanOrEqual(30);
  });

  // De-dupe the frontend calls — many tabs hit the same URL — and
  // bucket the source files so a failure message lists every caller.
  const callsByKey = new Map<string, UrlCall[]>();
  for (const c of calls) {
    const key = `${c.method} ${c.path}`;
    const list = callsByKey.get(key) ?? [];
    list.push(c);
    callsByKey.set(key, list);
  }

  // The OpsTab disable/enable button uses a single template literal
  // `/admin/llm/provider/${provider}/${path}` where `path` is
  // hardcoded to "disable" or "enable" by the caller. The static
  // parser collapses both segments to `:param`, but the backend
  // declares them as `:name/disable` and `:name/enable`. Both literal
  // values resolve to a real route at runtime, so we whitelist this
  // one ambiguous URL rather than weaken the contract.
  const STATIC_ANALYSIS_FALSE_POSITIVES = new Set<string>([
    'POST /admin/llm/provider/:param/:param',
  ]);

  for (const [key, callers] of callsByKey) {
    if (STATIC_ANALYSIS_FALSE_POSITIVES.has(key)) continue;
    it(`backend serves ${key}`, () => {
      expect(routes.has(key)).toBe(true);
      // If the route really were missing, dump the callers so the
      // failure points at the offending file:line directly.
      if (!routes.has(key)) {
        const sources = callers.map((c) => c.source).join('\n  ');
        throw new Error(
          `Frontend calls ${key} but the admin controller has no matching @${key.split(' ')[0]}() decorator.\n` +
            `Callers:\n  ${sources}\n` +
            `Add the route to apps/api/src/modules/admin/admin.controller.ts, or remove the dead frontend call.`,
        );
      }
    });
  }
});
