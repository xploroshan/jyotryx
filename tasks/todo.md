# MyAstro360 — SEO/AEO + Instagram Marketing: task tracker

Plan docs (this branch):
- `marketing/seo-aeo-action-plan.md` — prioritized SEO/AEO improvements
- `marketing/social/instagram-daily-engine.md` — automated daily Instagram engine

## SEO/AEO — P0 (this week, ops)
- [ ] Owner-review + publish the 6 draft `/learn` articles (flip `status:"draft"`)
- [ ] Verify prod Vercel env vars: `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_GSC_VERIFICATION`
- [ ] GSC domain property verified + sitemap submitted + top-10 URLs requested
- [ ] Bing Webmaster Tools (import from GSC)
- [ ] Confirm IndexNow workflow green
- [ ] Baseline: first AEO prompt-test pass + GA4 "AI referrers" segment

## SEO/AEO — P1 (weeks 1–4)
- [ ] `/learn` cluster → 10 playbook slugs (2/week)
- [ ] `DefinedTerm` + `HowTo` JSON-LD emitters; `Service` on tool pages
- [ ] `llms.txt` + `sitemap.ts` updated per new slug
- [ ] Localize horoscope/panchang FAQs (13 locale files in one change)

## Instagram engine — Phase 0 (setup)
- [ ] IG Business account + linked Facebook Page
- [ ] Meta app + long-lived token (`IG_ACCESS_TOKEN`, `IG_USER_ID` as secrets)
- [ ] S3 hosting path for post images
- [ ] Build `daily-sky.html` + `glossary.html` templates
- [ ] Hand-post 3 seed posts, check the grid on a phone

## Instagram engine — Phase 1 (human-in-loop, weeks 1–2)
- [ ] Seed `marketing/social/queue/queue.json` (14 topics in plan §7)
- [ ] Create daily Claude Routine (cron `0 2 * * *` UTC) — draft mode
- [ ] Create weekly Sunday Routine (insights, token refresh, queue top-up)
- [ ] 10 consecutive no-edit approvals → go to Phase 2

## Instagram engine — Phase 2+ (auto)
- [ ] Remove review gate; guardrails on (template-only, honesty rule, 1/day cap, kill switch, weekly digest)
- [ ] Month 2: port pipeline to GitHub Actions + Claude Agent SDK (`scripts/social/daily-post.mjs`)

## Review
_(fill in as items complete)_
