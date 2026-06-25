# Performance — measurement & optimization log

Goal: keep MyAstro360 **light and quick to load**. This file records the baseline, the changes, and
the measured effect. Methodology favors reproducible numbers (built chunk bytes, proven middleware
behavior) over one-off Lighthouse runs that vary with CI throttling.

## What was already good (audit, 3-agent)
Third-party scripts are disciplined (GA/PostHog `afterInteractive`, Firebase lazy-proxy, Razorpay
checkout-only); fonts optimized (Indic `preload:false` + unicode-range); no large raster images; API
already has an LLM response cache (deterministic features), a Redis chart/panchang/cosmic-calendar
cache, hot-path indexes, k6 load scripts, Lighthouse CI, and bundle budgets. `getSession` is bounded
(`take: 200`); cosmic-calendar is Redis-cached. So the prior review's "unbounded getSession / uncached
cosmic-calendar" were already addressed.

## Phase 1 — safe high-ROI set (this pass)

| Change | File | Effect |
|---|---|---|
| **Response compression (gzip)** | `apps/api/src/main.ts` (`app.use(compression())`) | **Biggest win.** Proven: `Content-Encoding: gzip`, repetitive astrology JSON compresses ~3–19× (19× on a 31-day cosmic-calendar payload). Reports/kundli/cosmic-calendar now ship a fraction of the bytes — big perceived-latency cut on mobile. |
| **HTTP cache headers** | `apps/api/src/modules/astrology/astrology.controller.ts` | `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` on the 5 public, day-stable GETs (`horoscope/:sign`, `/multi`, `chinese-zodiac/:year`, `panchang`, `cosmic-calendar`). Browser/CDN now absorb repeat hits — they never reach the API. |
| **Web Vitals field capture** | `apps/web/src/components/analytics/WebVitals.tsx` + `app/layout.tsx` | Closes the monitoring gap: LCP/INP/CLS/TTFB/FCP now flow to GA4 + PostHog (`web_vitals` event) for real-user perf tracking. ~+5KB. |
| **optimizePackageImports** | `apps/web/next.config.ts` | Added for `lucide-react`, `@tabler/icons-react`, `framer-motion`, `react-hot-toast`. **Measured no-op** here — the barrels weren't actually heavy (Tabler = 12 icons in one file; the others were already named imports). Kept as harmless + future-proofing. |

### Bundle (built `.next/static/chunks`, clean builds)
| Metric | Before | After Phase 1 |
|---|---|---|
| Total chunks | 3460.9 KB | 3466.0 KB (+5 KB = Web Vitals lib) |
| Chunks > 100 KB | 16 | 16 |
| Largest chunk | 221.1 KB | 221.1 KB |
| budget.json (300/200 KB) | pass | pass |

**Honest finding:** the client bundle is **not barrel-bloated**. The ~3.4 MB is the large feature surface
+ framework/vendor (top chunks 221/140/134 KB). The real client-side weight is **Sentry (~100KB+ in the
vendor chunk) and the always-bundled English i18n dict (`en.ts`, 77KB)** — addressed in Phase 2.

### Verification (Phase 1)
- `compression` gzips (standalone proof, 19×); web + API typecheck clean; web Vitest **540/540**;
  API Jest **89/89 suites** — no regressions.

## Phase 2 — deep set: investigated, mostly NOT warranted

The Phase 2 hypotheses (Sentry ~100KB, heavy barrels) did **not** survive contact with the built bundle:
- **Sentry replay is already tree-shaken out** — 0 chunks contain `rrweb`; total client Sentry footprint
  is ~12KB, not ~100KB. No lazy-load win available. (`replaysOnErrorSampleRate` in
  `sentry.client.config.ts` is inert without an added `replayIntegration()`, so replay never ships.)
- **Barrels weren't heavy** — Phase 1 `optimizePackageImports` was a measured no-op.
- The one real lever left is **`en.ts` (77KB source, ~15–20KB gzipped, always in the i18n base chunk)**.
  It's statically imported as the synchronous fallback for a heavily client-rendered, English-first app;
  splitting it risks text-flash + the i18n-parity system for ~15KB/page gzipped. **Deferred** — poor
  risk/reward on an already-lean bundle.
- **SSR-ifying `my-day`/`vedic`** (auth-gated, client-store + localStorage-cache pages) is a real per-page
  rewrite. **Deferred** — let the new Web Vitals capture show whether a specific route is actually slow in
  the field before rewriting it.

**Regression lock:** tightened `apps/web/budget.json` chunk budget 300KB → 260KB (current largest 221KB)
so future bloat fails CI.

## Conclusion
The frontend was already light — disciplined third-party loading, tree-shaken deps, optimized fonts, no
heavy raster images. The highest-impact "quick to load" change was **server-side gzip compression**
(Phase 1) on the data-heavy responses, plus **CDN cache headers** on public GETs and **Web Vitals field
monitoring**. Further frontend rewrites aren't justified by the measurements; revisit per-route only if
field Web Vitals flag a specific slow page.
