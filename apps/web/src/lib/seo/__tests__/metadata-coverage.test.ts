import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Route-level metadata coverage guard (SEO PR 2).
 *
 * The audit found 28 public routes shipping with NO metadata — all rendering
 * the root layout's generic title with no canonical. This test walks the app
 * router tree and asserts, by static inspection (no imports — client pages
 * pull in stores/browser APIs), that:
 *   - every PUBLIC page.tsx exports `metadata` or `generateMetadata`;
 *   - every NOINDEX app surface declares robots index:false.
 *
 * A new public route added without metadata fails here, not in a future audit.
 */

const APP_DIR = path.resolve(__dirname, "../../../app");

// Per-user / internal surfaces — excluded from the "must have SEO metadata"
// rule. Routes here that HAVE a page.tsx with a server wrapper must instead
// declare robots noindex (checked below) or be covered by the X-Robots-Tag
// header list in next.config.ts.
const PRIVATE_ROUTES = new Set([
  "admin", "auth", "reset-password", "checkout", "profile", "chat", "my-day",
  "reports", "referral", "decision-room", "horary/ask", "horary/history",
  "styleguide", "og", "match",
]);

// Routes whose page must explicitly declare robots noindex.
const NOINDEX_WRAPPED = ["horary/ask", "horary/history", "decision-room"];

function listPageFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listPageFiles(path.join(dir, entry.name), rel));
    else if (entry.name === "page.tsx") out.push(base);
  }
  return out;
}

const isPrivate = (route: string) =>
  [...PRIVATE_ROUTES].some((p) => route === p || route.startsWith(`${p}/`));

describe("metadata coverage", () => {
  const routes = listPageFiles(APP_DIR);

  it("finds a plausible number of routes (guards the walker itself)", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it.each(routes.filter((r) => !isPrivate(r)))(
    "public route '%s' exports metadata or generateMetadata",
    (route) => {
      const src = fs.readFileSync(path.join(APP_DIR, route, "page.tsx"), "utf8");
      const hasMetadata =
        /export\s+(const|async\s+function|function)\s+(metadata|generateMetadata)/.test(src);
      const isClient = src.trimStart().startsWith('"use client"') || src.trimStart().startsWith("'use client'");
      expect(
        hasMetadata && !isClient,
        `${route}/page.tsx must be a server module exporting metadata/generateMetadata ` +
          `(client pages cannot export metadata — use the server-wrapper pattern, see src/app/kundli/page.tsx)`,
      ).toBe(true);
    },
  );

  it.each(NOINDEX_WRAPPED)("app surface '%s' declares robots noindex", (route) => {
    const src = fs.readFileSync(path.join(APP_DIR, route, "page.tsx"), "utf8");
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("noindex header list in next.config covers the private page surfaces", () => {
    const cfg = fs.readFileSync(path.resolve(APP_DIR, "../../next.config.ts"), "utf8");
    for (const p of ["/styleguide", "/chat", "/my-day", "/reports", "/referral", "/decision-room"]) {
      expect(cfg, `next.config.ts headers() must include ${p}`).toContain(`"${p}"`);
    }
  });
});
