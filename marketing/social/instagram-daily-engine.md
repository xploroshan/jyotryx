# MyAstro360 — Instagram Daily-Post Engine (automated, Claude-driven)

> Goal: one clean, on-brand, knowledge-dense image post on `@myastro360` **every
> day**, generated and published by an automated Claude agent, with a human
> approval gate at first and guardrails when it goes full-auto.
>
> This complements — does not replace — the founder-on-camera Reels plan in
> [`social-playbook.md`](./social-playbook.md). Reels carry reach; this engine
> carries **consistency, the curated grid, and the AEO flywheel** (§8).
>
> Brand-voice vetoes from `social-playbook.md` apply to every post: no
> fear-selling, no fabricated proof, shows its work, warm and honest,
> "interpretation, not fact."

---

## 1. Why this can work (the unfair advantage)

Every astrology page posts generic zodiac memes. MyAstro360 has a
**deterministic engine** (Swiss Ephemeris, Lahiri ayanamsa) that computes real
daily data — tithi, nakshatra, rahu kaal per city, transits. That means the
daily post can carry a *number nobody can fake*: "Rahu Kaal in Mumbai today:
9:12–10:44 AM — here's how that's computed." Unique knowledge, dated,
verifiable, and impossible for meme pages to copy without an engine.

The second advantage: the `/learn` cluster and `feature-content.ts` already
contain expert-reviewed explanations of every concept. The engine repurposes
content that already exists — write once, publish twice (web for AEO,
Instagram for reach).

---

## 2. Visual system — "cool, trendy, clean"

One template family so the grid looks curated, not generated.

- **Canvas:** 1080×1350 (4:5 portrait — maximum feed real estate). Carousels:
  up to 7 slides, same canvas.
- **Look:** the existing OG-card brand, evolved for feed — deep night-sky
  gradient (near-black indigo), **gold accent** (the `/og` brand gold), a big
  serif display headline, generous whitespace, thin gold hairline rules, a
  subtle star-field/chart-wheel watermark at low opacity. Small `myastro360`
  wordmark bottom-corner, never a giant logo.
- **One bold hero element per image** (same rule as the OG cards): a big
  stat, a big word, or a big question. Everything else is supporting text.
- **Typography:** the site's display serif for heroes, clean sans for body.
  Indic names/terms render via the `NOTO_INDIC` font set already used by
  `/match/[token]/og` — Hindi/Tamil terms must never show as tofu boxes.
- **How images are made:** HTML/CSS templates rendered to PNG by headless
  Chromium (Playwright screenshot at 2× then downscale, or 1080×1350 direct).
  **Not** AI-generated imagery. Reasons: pixel-consistent brand, deterministic
  output, correct Indic text, zero uncanny artifacts. AI-generated *backgrounds*
  can be layered in later as a controlled experiment, never for text.
- **Templates live in-repo:** `marketing/social/templates/` — one HTML file per
  pillar (`daily-sky.html`, `lesson.html`, `myth-bust-carousel.html`,
  `glossary.html`, `quote.html`), each with `{{placeholders}}` the agent fills.
  Template changes are code-reviewed like anything else; the agent may only
  fill placeholders, never restyle.

---

## 3. Content pillars — the 7-day rotation

| Day | Pillar | Format | Content source | Example hero |
|---|---|---|---|---|
| Mon | **Myth-bust** (flagship) | Carousel 5–7 slides | `/learn` article or `feature-content.ts` | "Mangal Dosha won't ruin your marriage. Here's what it actually is →" |
| Tue | **Today's Sky** | Single image | Live panchang API (tithi, nakshatra, rahu kaal for a rotating featured city) | "Rahu Kaal · Mumbai · 9:12–10:44 AM" |
| Wed | **Shows-its-work mini-lesson** | Single or 3-slide | House/planet/dasha explainers | "Your 8th house isn't scary. It's about depth." |
| Thu | **Glossary card** ("What is X?") | Single image | Mirrors a `/learn/[slug]` definition, verbatim first-paragraph answer | "What is a nakshatra? 27 lunar mansions, computed from the Moon's sidereal longitude." |
| Fri | **Muhurat / weekend window** | Single image | Live panchang/muhurat data | "Good weekend to start something? Here's the window — and the why." |
| Sat | **NRI corner** | Single or carousel | Timezone/birth-time content | "Born in India, living abroad? Your chart is probably set up wrong." |
| Sun | **Compatibility / guna insight** | Carousel 4–5 slides | Guna milan / matching explainers | "36 gunas. Here's what each koota actually scores." |

Rules:
- **Today's Sky and Muhurat use live engine data only** — if the API call
  fails, the agent falls back to an evergreen Glossary card. It **never
  fabricates panchang numbers** (fabricated determinism would destroy the
  entire positioning).
- Rotate the featured city weekly (Mumbai → Delhi → Bengaluru → Chennai →
  Hyderabad → Kolkata → a diaspora city like Dubai/London for NRI week).
- Every myth-bust and glossary post maps 1:1 to a `/learn` slug (§8).

## 4. Caption system

Structure (the agent fills this skeleton every day):

1. **Hook line** — reuse/adapt the 15-hook bank in `social-playbook.md` §6.
2. **The why** — 2–4 short paragraphs tracing the claim to a chart factor
   (house, planet, dasha, guna). This is the "shows its work" promise in text.
3. **The honesty line** — a natural-language version of "interpretation, not
   fact" (vary the wording, keep the substance).
4. **CTA** — alternate between "save this" / "share with someone who was told
   X" (top-of-funnel) and "pull your own chart — link in bio" (conversion).
5. **Hashtags** — 10–15, mixed tiers: 3–4 broad (`#vedicastrology #astrology
   #kundli`), 5–7 niche (`#nakshatra #panchang #gunamilan #sadesati
   #vedicastrologer #jyotish`), 2–3 branded/campaign (`#myastro360
   #showsitswork`). Keep a rotating pool in the queue file so posts don't
   repeat an identical block (spam signal).
6. **Alt text** — always set via the API (`accessibility` + it's indexed).

Link in bio → `myastro360.com` with UTMs per `social-playbook.md` §7:
`utm_source=instagram&utm_medium=organic&utm_campaign=<pillar-slug>`.
(Use a bio-link page or Instagram's native multi-link; one link per pillar is
overkill — one UTM'd link, campaign updated to the current flagship, is enough.)

---

## 5. Automation architecture

### 5a. One-time prerequisites (human, ~1–2 hours)

1. **Instagram professional account** — convert `@myastro360` to a
   Business/Creator account and link it to a Facebook Page (required for API
   publishing).
2. **Meta developer app** — create at developers.facebook.com, add the
   Instagram Graph API product, grant `instagram_basic`,
   `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
   Generate a **long-lived access token** (60-day expiry — the agent's weekly
   job refreshes it and alerts at <14 days remaining). Record the IG user ID.
3. **Image hosting** — the Graph API publishes from a **public image URL**.
   Use the existing S3 bucket (already allow-listed in `next.config.ts`
   `remotePatterns`) under `social/YYYY/MM/DD-<slug>.png`. Do *not* route
   through a site deploy just to host a PNG.
4. **Secrets** — `IG_ACCESS_TOKEN`, `IG_USER_ID`, S3 credentials. Stored as
   environment variables in whichever runner is chosen in §5c (Claude
   environment settings or GitHub Actions secrets). Never committed.

### 5b. The daily pipeline (what the agent does each run)

```
pick → write → render → review-gate → publish → log
```

1. **Pick** — read `marketing/social/queue/queue.json` (a 30-day rolling
   queue, seeded in §7). Today's entry names the pillar, topic, `/learn` slug
   (if any), template, and city. For Today's Sky / Muhurat, fetch live data
   from the panchang API.
2. **Write** — produce slide text, caption (per §4), hashtags, alt text.
   Self-check against the brand-voice vetoes before proceeding (a literal
   checklist in the agent prompt: fear-selling? fabricated numbers? untraceable
   claim? → rewrite or fall back).
3. **Render** — fill the pillar's HTML template, screenshot with headless
   Chromium at 1080×1350, one PNG per slide.
4. **Review gate** — Phase 1 only (§6): stop here, hand the draft to the
   founder for approval. Phase 2: skip.
5. **Publish** — upload PNG(s) to S3 →
   `POST /{ig-user-id}/media` (`image_url`, `caption`, `alt_text`) per image;
   for carousels, create child containers then a `media_type=CAROUSEL`
   container; then `POST /{ig-user-id}/media_publish`. Poll the container
   `status_code` until `FINISHED` before publishing. On any API error: retry
   3× with backoff, then **skip the day and flag** — never double-post.
6. **Log** — append `{date, pillar, topic, media_id, permalink, hook}` to
   `marketing/social/log/YYYY-MM.json` and mark the queue entry done; commit
   both to the repo so the content history is versioned and greppable.

Weekly (Sunday run, same agent): pull last 7 days' insights
(`/{media-id}/insights`: reach, saves, shares, profile visits), append to the
log, refresh the access token if <14 days left, and top up the queue back to
30 days — biasing new topics toward whichever pillar had the best
saves-per-reach (saves are the algorithm's strongest "knowledge content"
signal).

### 5c. Where the agent runs — three options

| | Option A — Claude Routine (recommended start) | Option B — GitHub Actions + Claude Agent SDK (durable end-state) | Option C — Claude batch + Buffer/Later |
|---|---|---|---|
| **What** | A scheduled Claude Code Routine (cron trigger) spawns a fresh Claude session daily; the session follows the runbook in this doc | A repo script (`scripts/social/daily-post.mjs`) built on `@anthropic-ai/claude-agent-sdk`, run by a GH Actions cron; Claude generates copy, deterministic code does render/publish | Claude generates 7 posts every Sunday in one sitting; a scheduling tool (Buffer/Later) publishes daily |
| **Judgment in the loop** | Full — the model can handle API hiccups, odd panchang edge cases, rewrite weak hooks | Partial — copy is model-written, control flow is fixed code | Full at generation, none at publish |
| **Infra to build** | None (create the Routine, set env secrets) | The script + workflow (a day of work) | None; needs a Buffer/Later account |
| **Failure mode** | Session errors → no post that day (flagged) | Same, plus CI visibility | Scheduler is very reliable |
| **Cost** | Claude usage per day | API tokens per day (small) + free Actions | Claude weekly + scheduler subscription |
| **Best for** | Phase 1–2, iterate fast on prompts/templates | Phase 3, once the format is stable | Founders who want zero Meta-app setup (Buffer holds the IG auth) |

**Recommended path: start on A, graduate to B.** Option A needs zero new code
and keeps full judgment in the loop while the format is still being tuned.
Once 3–4 weeks of posts have validated the templates and prompts, port the
pipeline into Option B so the automation is version-controlled, reviewable,
and independent of any interactive session. Option C is the fallback if the
Meta app approval stalls — Buffer's API access substitutes for your own.

**Routine setup (Option A), concretely:** a daily cron trigger at
`0 2 * * *` UTC (07:30 IST — Today's Sky lands before the workday) that
spawns a fresh session in this repo's environment with the prompt:

> Run the MyAstro360 Instagram daily post. Follow the runbook in
> `marketing/social/instagram-daily-engine.md` §5b exactly: read today's entry
> from `marketing/social/queue/queue.json`, generate, render, publish (Phase
> 1: commit the draft to the `social-drafts` branch and stop for approval),
> then update the log and queue. Obey the brand-voice vetoes. If live data is
> unavailable, use the evergreen fallback. Never fabricate panchang values,
> never post twice.

A second weekly Routine (Sunday) runs the insights + token-refresh + queue
top-up job from §5b.

---

## 6. Phased rollout (safety first, then speed)

**Phase 0 — setup (this week).** Do §5a prerequisites. Build the first two
templates (`daily-sky.html`, `glossary.html`). Hand-post 3 seed posts to
verify the look on a real phone grid and calibrate.

**Phase 1 — human-in-the-loop (weeks 1–2).** The daily Routine runs the full
pipeline but *stops before publish*: it commits the rendered PNG + caption to
a `social-drafts` branch (or sends them for review). The founder approves —
one tap — and either publishes manually or lets the agent's next run publish
approved drafts. Purpose: catch voice violations, template bugs, and awkward
copy while the cost of a mistake is zero.

**Phase 2 — full auto with guardrails (week 3+).** Remove the gate once
Phase 1 has produced ~10 consecutive approvals with no edits. Guardrails that
stay on permanently:
- **Template-only rendering** — the agent fills placeholders; it cannot
  restyle or free-render imagery.
- **Live-data honesty rule** — engine data or evergreen fallback; never
  invented numbers.
- **Brand-voice self-check** — the veto checklist runs on every caption
  before publish.
- **One post/day hard cap**; a failed run skips, flags, and never retries into
  a double post.
- **Kill switch** — disabling the Routine trigger stops everything instantly.
- **Weekly digest** — the Sunday run reports the week's posts + metrics, so
  silence never hides a broken pipeline.

**Phase 3 — harden (month 2).** Port to Option B (GitHub Actions). Add
Stories re-shares of the daily post, and experiment with 1–2 AI-background
variants per week as a controlled A/B.

---

## 7. Seed queue — first 14 days

The starting `queue.json` content (topics only; the agent expands each into
copy on the day). Myth-busts and glossaries name their `/learn` twin.

| # | Pillar | Topic | /learn twin |
|---|---|---|---|
| 1 | Myth-bust | Mangal Dosha ≠ marriage doom — placements + cancellation rules | `manglik-dosha` |
| 2 | Today's Sky | Tithi + nakshatra + Rahu Kaal, Mumbai | — |
| 3 | Mini-lesson | The 8th house: depth, not doom | — |
| 4 | Glossary | What is a nakshatra? | `nakshatras-overview` |
| 5 | Muhurat | Weekend window + why (real data) | `choosing-muhurat` |
| 6 | NRI corner | The one birth-time setting NRIs get wrong | — |
| 7 | Compatibility | The 8 kootas of guna milan, scored | — |
| 8 | Myth-bust | Sade Sati: what Saturn's 7.5 years actually are | — |
| 9 | Today's Sky | Delhi edition | — |
| 10 | Mini-lesson | Rashi vs sun sign — why your "sign" may differ | `rashi-vs-sun-sign` |
| 11 | Glossary | What is Kaal Sarp Dosha, honestly? | `kaal-sarp-dosha` |
| 12 | Muhurat | Good day to sign/launch/move — this weekend's windows | `choosing-muhurat` |
| 13 | NRI corner | DST and your birth chart: a 1-hour error changes the lagna | — |
| 14 | Compatibility | Navamsa (D9): the marriage chart explained | `navamsa-d9` |

---

## 8. The Instagram ↔ SEO/AEO flywheel

This engine is not just social — it feeds the search plan
([`../seo-aeo-action-plan.md`](../seo-aeo-action-plan.md)):

1. **Write once, publish twice.** Every glossary/myth-bust post is a
   compressed `/learn` article; every new `/learn` article yields a carousel.
   The queue and the `/learn` backlog are maintained as one topic list.
2. **UTM'd bio link** makes Instagram's contribution visible in GA4 next to
   AI-referral and organic (measurement plan already standardizes this).
3. **Entity consolidation.** The IG profile is in the Organization JSON-LD
   `sameAs` already; an active, consistent profile strengthens the brand
   entity that answer engines attach citations to — and Google indexes IG
   profiles/posts for brand queries.
4. **Saves as keyword research.** Saves-per-reach per topic is a free demand
   signal for which `/learn` pages to write next.

## 9. Measurement (weekly, 10 minutes — fold into the §7 review in social-playbook.md)

- **Per post:** reach, saves, shares, profile visits (agent pulls these
  automatically Sundays).
- **North-star for this engine:** saves-per-reach (knowledge value) and
  UTM'd bio-link sessions → signups (GA4).
- **Grid health (manual, monthly):** does the profile still look curated on a
  phone? Screenshot the grid, compare month-over-month.
- **Act on it:** the Sunday queue top-up biases toward the winning pillar;
  a pillar that underperforms for 4 straight weeks gets reworked or replaced.
