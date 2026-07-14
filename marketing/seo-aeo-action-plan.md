# MyAstro360 — SEO/AEO Action Plan (gap-driven, prioritized)

> The technical SEO layer is already mature: SSR/SSG landing pages,
> self-canonicals + hreflang across 12 locales, dynamic sitemap + robots with
> an AI-crawler allowlist, Organization/Article/FAQPage/Breadcrumb JSON-LD,
> dynamic OG images, `llms.txt`, IndexNow automation, performance budgets.
> **The remaining gaps are operational and content-side, not markup.** This
> plan lists only what is *not yet done*, in priority order, grounded in a
> codebase audit (2026-07-13).
>
> Companion docs (already written — this plan sequences them, it doesn't
> repeat them): [`../docs/seo.md`](../docs/seo.md) (indexing runbook),
> [`../docs/seo-growth.md`](../docs/seo-growth.md) +
> [`../docs/seo-backlinks.md`](../docs/seo-backlinks.md) (authority),
> [`ai-seo/aeo-playbook.md`](ai-seo/aeo-playbook.md) (answer engines),
> [`social/instagram-daily-engine.md`](social/instagram-daily-engine.md)
> (the social flywheel that feeds this).

---

## P0 — Unblock what's already built (this week, mostly ops)

These are hours of work that activate months of shipped engineering.

1. **Publish the six draft `/learn` articles.** They exist
   (`apps/web/src/lib/learn/content/`: nakshatras, manglik-dosha,
   kaal-sarp-dosha, choosing-muhurat, navamsa-d9, rashi-vs-sun-sign) but ship
   `status:"draft"`. Owner-review each, flip to published, set real
   `datePublished`. This is the single cheapest AEO win available — the
   definitional cluster the AEO playbook calls for is half-built and dark.
2. **Verify production env vars are actually set in Vercel.** GA4
   (`NEXT_PUBLIC_GA_ID`), PostHog (`NEXT_PUBLIC_POSTHOG_KEY`), GSC
   (`NEXT_PUBLIC_GSC_VERIFICATION`) are all env-gated; if any is unset in
   prod, that whole subsystem is silently off. Check, set, redeploy.
3. **Google Search Console + Bing Webmaster Tools** per `docs/seo.md` §0–§1:
   verify the domain property, submit `sitemap.xml`, URL-inspect and request
   indexing for the top ~10 pages. Import the property into Bing (feeds
   ChatGPT/Copilot search).
4. **Confirm the IndexNow GitHub Action is green** (`.github/workflows/
   indexnow.yml`) and firing on the daily cron + deploys.
5. **Baseline measurements** so later work is provable: run the first monthly
   AEO prompt-test pass (aeo-playbook §6a) and create the GA4 "AI referrers"
   segment (§6b). Record `site:myastro360.com` count.

## P1 — Expand the definitional cluster (weeks 1–4, content + light code)

1. **Fill the `/learn` cluster to the playbook's 10 Tier-1/Tier-2 slugs**
   (aeo-playbook §3): add `kundli`, `kundli-matching`, `sade-sati`,
   `rahu-kaal`, `panchang`, `mulank`, `vimshottari-dasha`,
   `vedic-vs-western-astrology` to the existing six. Each: question-led H1,
   40–60-word first-paragraph answer, HowTo steps naming Swiss
   Ephemeris/Lahiri, dense cross-links to the tool page + 2–3 sibling terms.
2. **Add `DefinedTerm` + `HowTo` JSON-LD emitters** alongside the existing
   FAQPage emitter (aeo-playbook §7) and ship them on every `/learn` page;
   add `Service` schema to the tool pages as a fast follow.
3. **Update `llms.txt` and `sitemap.ts`** with each new `/learn` URL as it
   ships (release-checklist item, aeo-playbook §5).
4. **Localize the horoscope/panchang FAQs** into the locale dictionaries
   (aeo-playbook §4) — clears the mixed-language signal on 11 locales and
   unlocks vernacular AEO. Respect the i18n-parity test (all 13 files in one
   change, genuinely translated).
5. **Cadence:** 2 `/learn` articles/week is enough; each one also becomes an
   Instagram carousel (write once, publish twice — see §Flywheel).

## P2 — Authority (weeks 2–8, ongoing)

Execute the existing playbooks; nothing new to design:

1. **Quick-win backlinks weekend** — directories, social profiles, Product
   Hunt prep per `docs/seo-growth.md` Part A (asset pack is ready-to-paste in
   Part B).
2. **The `/learn` hub as link magnet + data-PR asset** per
   `docs/seo-backlinks.md` §2–§3.
3. **Community presence** (Reddit/Quora, value-first) per
   `community/community-playbook.md` — citations there are also AI-training
   surface.

## P3 — Monitor & iterate (monthly, 1–2 hours)

- Monthly AEO prompt-test pass across ChatGPT/Perplexity/Gemini/Claude;
  headline metric = share of citations (aeo-playbook §6a).
- GA4 monthly: AI-referral sessions, `/learn/*` landing performance,
  Instagram UTM sessions → signup conversion.
- GSC monthly: indexed-page count, top queries, long-tail city×language
  winners → double down in content.
- Optional acceleration: keyword/competitor pulls via Ahrefs or Semrush
  (both available as MCP connectors in Claude sessions) to pick the next
  `/learn` slugs by real volume instead of intuition.
- Watch item from the audit: root `<html lang>` is client-patched on the 11
  localized locales (documented SSG trade-off). Revisit only if vernacular
  rankings stall — it's a known, deliberate deferral.

## The flywheel with Instagram

The daily Instagram engine
([`social/instagram-daily-engine.md`](social/instagram-daily-engine.md)) and
this plan share one topic backlog:

- Every `/learn` article → a glossary/myth-bust carousel; every carousel
  topic that earns high saves-per-reach → the next `/learn` article.
- The UTM'd bio link makes Instagram's SEO contribution measurable in the
  same GA4 property as AI referrals and organic.
- An active IG profile strengthens the brand entity (already in Organization
  `sameAs`) that answer engines attach citations to.

## Review

| Milestone | Proof it worked |
|---|---|
| P0 done | `/learn` pages indexed (GSC), analytics events visible in prod GA4/PostHog |
| P1 done | 14+ `/learn` pages live with DefinedTerm/HowTo; first AI citation logged in a prompt test |
| P2 rolling | Referring domains trend up (GSC links report); first non-directory backlink |
| P3 rolling | Month-over-month: share of citations ↑, AI-referral sessions ↑, IG-UTM signups ↑ |
