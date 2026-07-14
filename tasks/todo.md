# MyAstro360 — SEO/AEO + Instagram Marketing: task tracker

Plan docs (this branch):
- `marketing/seo-aeo-action-plan.md` — prioritized SEO/AEO improvements
- `marketing/social/instagram-daily-engine.md` — automated daily Instagram engine

## SEO/AEO — P0 (this week, ops)
- [x] Owner-review + publish the 6 draft `/learn` articles (flip `status:"draft"`)
- [ ] Verify prod Vercel env vars: `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_GSC_VERIFICATION`
- [ ] GSC domain property verified + sitemap submitted + top-10 URLs requested
- [ ] Bing Webmaster Tools (import from GSC)
- [ ] Confirm IndexNow workflow green
- [ ] Baseline: first AEO prompt-test pass + GA4 "AI referrers" segment

## SEO/AEO — P1 (weeks 1–4)
- [x] `/learn` cluster → 10 playbook slugs (2/week)
- [x] `DefinedTerm` + `HowTo` JSON-LD emitters; `Service` on tool pages
- [x] `llms.txt` + `sitemap.ts` updated per new slug
- [x] Localize horoscope/panchang FAQs (13 locale files in one change)

## Instagram engine — Phase 0 (setup)
- [ ] IG Business account + linked Facebook Page
- [ ] Meta app + long-lived token (`IG_ACCESS_TOKEN`, `IG_USER_ID` as secrets)
- [ ] S3 hosting path for post images
- [x] Build `daily-sky.html` + `glossary.html` templates
- [ ] Hand-post 3 seed posts, check the grid on a phone

## Instagram engine — Phase 1 (human-in-loop, weeks 1–2)
- [x] Seed `marketing/social/queue/queue.json` (14 topics in plan §7)
- [x] Create daily Claude Routine (cron `0 2 * * *` UTC) — draft mode
- [x] Create weekly Sunday Routine (insights, token refresh, queue top-up)
- [ ] 10 consecutive no-edit approvals → go to Phase 2

## Instagram engine — Phase 2+ (auto)
- [ ] Remove review gate; guardrails on (template-only, honesty rule, 1/day cap, kill switch, weekly digest)
- [x] Month 2: port pipeline to GitHub Actions + Claude Agent SDK (`scripts/social/daily-post.mjs`)

## Review (2026-07-14)
Development complete on this branch: 14 published /learn articles (no status
field existed — "publish" was editorial-comment + dates), DefinedTerm/HowTo/
Service JSON-LD, FAQ localization across all 12 locales (parity green),
full Instagram engine (templates, render/publish pipeline, queue with 14
posts of copy, GH Actions with kill switch, node:test suite incl. chromium
renders), 20 Playwright e2e guards, Claude Routines created (disabled until
merge). Remaining unticked items are human/ops tasks (accounts, tokens,
GSC/Bing, env vars) — see marketing/seo-aeo-action-plan.md P0.
