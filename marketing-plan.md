# MyAstro360 — 12-Month Marketing Plan (v1)

**Prepared for:** MyAstro360 (founder)
**Prepared by:** fCMO engagement
**Date:** 2026-06-24
**Status:** v1 draft — open for section-level revision
**Client archetype:** D2C consumer app (subscription), India-first + NRI, with a deep-tech-credibility overlay ("deterministic engine / shows its work")
**Operating reality:** Bootstrapped (<₹50k/mo marketing), pre-launch / just live, solo founder (AI-augmented), Android app in ~1–3 months
**Growth phase:** 0 → ₹10L ARR (the "grueling" phase) — binding constraint is **activation + first repeatable paying loop**, not awareness

---

## 1. Executive summary

MyAstro360 is the rare bootstrapped consumer app whose product *is* a marketing engine. Every kundli, horoscope, panchang, and numerology reading it can generate for a paying user it can also generate as an indexable web page or a free tool — at **zero marginal cost**, in **12 languages**. Astrosage built an ugly version of this and ranks for everything; Astrotalk ignored it entirely and bills by the minute. Our wedge is to do Astrosage's content game *beautifully and transparently*, while owning a positioning Astrotalk can't copy: **the meter never runs.**

**The three big bets:**

1. **Win organic through the content-engine moat.** Programmatic SEO (per-sign horoscopes, panchang-by-date, numerology/mulank-by-name, sign×sign compatibility, nakshatra/muhurat pages) × 12 languages + free tools as lead magnets. This is the only acquisition channel that compounds for free, and we are structurally advantaged at it. It is the spine of the whole plan.
2. **Own "the meter never runs" + "shows its work."** A messaging wedge that peels the large pool of people who distrust or can't afford Astrotalk's per-minute meter and dislike Astrosage's black-box AI. This is positioning, not a price change — pricing stays ₹499/mo, ₹4,999/yr.
3. **Make WhatsApp + the daily briefing + memory the retention and distribution loop.** Native to India, no-install friction, and a continuity moat (the AI remembers your context) that no human marketplace can match.

**90-day priorities (founder's call — acquisition first):** (1) **Extend** the **programmatic-SEO engine** (already built — ~500 URLs) into the high-demand clusters it doesn't yet cover (sign×sign compatibility, numerology/mulank, vs-competitor pages, a blog) and deepen AI-SEO — the compounding top-of-funnel that's free to us. (2) **Launch Android** with a tuned Play Store listing + ASO. (3) **Light-touch instrumentation in parallel** (GA4 + PostHog) — a day-one task, not a phase — so you can see which acquisition actually works. (4) Tighten the **activation** path ("first meaningful reading") so the traffic you earn converts instead of leaking.

**12-month outcome:** a *proven, low-CAC* acquisition → activation → retention loop — programmatic SEO indexing and compounding, a first few hundred paying subscribers, a daily-active retention spine (briefing + WhatsApp), and a referral loop (Synastry sharing) — that earns the right to either a small paid-acquisition test or a raise. We are not promising a hockey stick; we are building the first S-curve so the second one has something to stand on.

**The honest risks, named up front:** activation rate and CAC are unknown (pre-launch) — every projection below is gated on instrumenting them in the first two weeks. As a solo founder, *focus is the scarce resource*, so this plan deliberately says no to paid ads, events, hiring, and a human-astrologer marketplace for the next ~6 months.

---

## 2. Strategic frame

**Category claim.** Reframe the category from *"talk to an astrologer (per minute)"* to *"your always-on astrology companion that shows its work."* MyAstro360 is the **anti-Astrotalk**: unlimited, private, judgment-free, deterministic-accurate, with no fake astrologers and no fear-selling.

**The three positioning pillars** (already live in the homepage/pricing relaunch — this plan rolls them across every surface):
1. **The meter never runs.** Flat ₹499/mo unlimited vs. ~₹500 for ten minutes on a per-minute marketplace.
2. **Same math, every time.** Swiss Ephemeris + Lahiri determinism. The chart is identical on every run; the AI explains it, it doesn't invent it.
3. **No fake astrologers, no fear-selling.** Transparency over theatrics. "Interpretation, not fact."

**ICP, distilled.** Urban + NRI Indians, 22–38, English/Hindi-first, smartphone-native. Three jobs-to-be-done sub-segments:
- *The curious skeptic* — wants accuracy **and** "show me why" (served by the Show-Your-Work transparency layer).
- *The relationship/decision seeker* — matching, synastry, "should I take this job / marry in November" (served by Matching, Decision Room, Cosmic Calendar).
- *The NRI* — wants real Vedic astrology in good English, time-zone-correct, culturally grounded (served by i18n + the just-shipped per-user timezone fix).

**Business-model logic.** Freemium subscription. Generous free tier (the calculators/tools — kundli, numerology, mulank, panchang, daily briefing) because they cost ~nothing to serve and double as the top of the funnel. Premium (₹499/mo · ₹4,999/yr) = unlimited chat + the high-value, forward-looking features (Decision Room, Cosmic Calendar, voice). Zero marginal cost per chart is what makes generous-freemium financially sane here, and it is the core asymmetry vs. a human marketplace.

**Brand-voice non-negotiables** (these veto tactics, so they live in the strategy, not a style guide):
- **No fear-selling.** No "doom unless you buy a gemstone." Remedies framed as optional, transparent.
- **No fake astrologers / no fabricated social proof.** We will not invent testimonials or personas — it would detonate the entire trust thesis.
- **Shows its work.** Every claim can be traced to a chart factor.
- **Warm, honest, judgment-free.** "Interpretation, not fact." Warm Linen aesthetic.

> Every section below is filtered through these voice rules. Several otherwise-standard growth tactics (false scarcity, countdown-fear urgency, fabricated reviews, "astrologer is typing…" theatrics) are **explicitly skipped** in §12 because they contradict the thesis.

---

## 3. Current state (scored from materials, 2026-06-24)

Scored against the 17-section rubric. Strengths cluster in the **"what we say"** layer (positioning, messaging, i18n, homepage, pricing) — that's built and good. Gaps cluster in the **"how strangers find us and become habitual paying users"** layer (research, content/SEO, lifecycle, CRO instrumentation, launch) — that's essentially empty. The plan exists to convert the first into the second.

| # | Section | /5 | Read |
|---|---|---|---|
| 1 | Positioning | 4 | "Meter never runs" is distinctive; needs rollout to Play Store + social. |
| 2 | Customer research | 1 | Founder intuition only; no voice-of-customer capture. **Top gap.** |
| 3 | Homepage | 4 | Redesigned, on-brand, multilingual. |
| 4 | Sales / product pages | 3 | Feature pages carry explainer + FAQ-schema SEO sections; still not fully conversion-tuned. |
| 5 | Conversion pages | 3 | Pricing clear; free-tool feature pages exist with explainer/FAQ; no dedicated comparison landers yet. |
| 6 | Competitor comparison | 1 | No "vs Astrotalk / vs Astrosage" pages. |
| 7 | Resources / content | 1 | No blog / content hub. |
| 8 | Onboarding | 2 | Exists; activation unproven and unmeasured. |
| 9 | Email lifecycle | 1 | Thin / unbuilt. |
| 10 | Sales material | N/A | Self-serve. |
| 11 | Messaging | 4 | Strong, voice-disciplined. |
| 12 | Pricing | 4 | Clear flat pricing; annual default not yet enforced. |
| 13 | CRO | 3 | Redesigned; funnel now instrumented (GA4 + PostHog, 5-event funnel shipped) — data starting to accrue. |
| 14 | GTM launches | 2 | Android launch upcoming; no launch muscle yet. |
| 15 | Ads (paid) | 0 | None — correct for bootstrapped. |
| 16 | SEO | 4 | **Engine already built** — ~500 programmatic URLs (per-sign horoscope, per-city panchang/kundli), llms.txt, AI-crawler allowlist, JSON-LD, hreflang. Gap is now *coverage depth* (sign×sign, numerology clusters, comparison pages, blog), not foundation. |
| 17 | Internationalization | 5 | 12 languages with enforced parity — exceptional, a moat. |

**Total ≈ 42 / 80** (excl. N/A; revised up from 37 after a 2026-06-25 codebase audit — see changelog). **Shape:** you have built a beautiful, well-positioned, multilingual product *and* a real programmatic-SEO engine and a now-instrumented funnel. The remaining gaps are not foundational — they are **coverage depth** (more SEO clusters, comparison pages, a blog), the **conversion layer** (annual default, value-moment paywall), the **share/referral loop**, and **community + lifecycle**. The expensive part (product + positioning + i18n + SEO engine) is done; the next 12 months is *extend, measure, convert, distribute*.

---

## 4. Acquisition — how strangers become aware

**Archetype note:** D2C consumer app acquisition normally leans ASO + paid social. Bootstrapped + content-engine product flips the priority order to **organic/SEO first, ASO second, paid last.** Our unfair advantage is that publishing astrology content costs us nothing.

### Current state
No live channel. Latent assets: a deterministic engine that can render unlimited unique, accurate astrology pages; 12-language i18n; free tools already built.

### The plan (numbered moves)

**A1 — Programmatic SEO (the spine, the moat).** Generate page clusters from the engine the app already runs:
- Per-sign daily/weekly/monthly horoscope (12 signs × {today, this week, this month} × 12 languages).
- Panchang by date + by city ("panchang for [city] [date]", "today's tithi/nakshatra/rahukaal").
- Numerology / **Mulank** by name and by birth-date ("mulank for [number]", "[name] numerology").
- Sign × sign compatibility (12 × 12 = 144 pages × languages) — captures the enormous "[sign] and [sign] compatibility" search demand.
- Nakshatra, dasha, dosha (mangal/sade-sati), muhurat-by-date explainer pages.
- Each page: real computed data + a short transparent explanation + a soft CTA ("save this / get it daily / see your full chart" → signup). This is the **engineering-as-marketing** play, and the i18n parity multiplies every template 12×. *This is the single highest-leverage thing in the entire plan.*

**A2 — Free tools as lead magnets.** The free kundli, numerology, mulank, matching, and panchang tools are top-of-funnel assets, not just product. Make each one (a) indexable, (b) shareable (OG image of the result), (c) softly gated (show result → "save / get your daily reading" → signup). Astrosage's free tools are its entire SEO empire; ours are prettier and honest.

**A3 — ASO / Play Store (sequenced to the Android launch).** Optimize the listing for high-volume vernacular intent: *kundli, horoscope, rashifal, kundli matching, panchang, numerology* in English + Hindi. Screenshots that lead with the two things competitors can't claim — **"unlimited, no per-minute meter"** and **"shows its work / private."** Seed honest early reviews from real beta users. Apple/iOS comes later.

**A4 — Answer-engine / AI SEO.** The transparency thesis is tailor-made to be cited by ChatGPT/Gemini/Perplexity ("how does kundli matching work?", "what is sade sati?"). Publish clear, sourced explainers; add structured data (FAQ/Article schema). Goal: be the cited source for Indian astrology questions in AI answers.

**A5 — Community marketing (founder-led, authentic).** Reddit (r/astrology, r/IndianAstrology, r/india), Quora India (astrology is one of its biggest topics), and a few Vedic-astrology Facebook groups. Rule: answer genuinely, link a free tool only when it actually helps. 3–5 high-quality answers/week. Zero budget, high trust.

**A6 — WhatsApp distribution.** Daily briefing + ask-anything over WhatsApp (Meta Cloud API). No-install, native to India, inherently shareable ("forward your daily to a friend"). Start Meta business verification + template approval **now** — it has lead time.

**A7 — Founder-led short-form video.** Ride the massive Indian astrology-content wave on Reels/Shorts with the differentiated angle: *"here's what your chart actually says — no fear, here's the why."* 2–3/week, repurposed across platforms. Cheapest brand-building available to a solo founder who can be on camera.

**A8 — PR + directories (the story angle).** "The astrology app that refuses to fear-sell / bills flat, not by the minute / shows its math" is a genuine hook for Indian startup press (YourStory, Inc42) and consumer tech. Plus Product Hunt + AI/astrology directory submissions for backlinks and a launch spike.

### 90-day moves
Ship pSEO template #1 (per-sign daily horoscope) + sitemap (Wk 1–2) → free-tool landing pages indexable + soft gate (Wk 3–4) → Android Play Store launch + ASO + scale pSEO clusters + start short-form + Product Hunt/directories (Wk 5–8) → community cadence steady, WhatsApp MVP, first PR outreach (Wk 9–12).

### 12-month outlook
SEO compounds (pages index over Q2–Q3); WhatsApp loop and short-form build a brand layer; one paid *test* only after a repeatable activation loop exists (likely Q3, and only if budget/raise appears). International/NRI ASO + content (US/UK/Canada/Gulf, English) becomes a deliberate second S-curve in Q3–Q4.

### Skills + tools
`programmatic-seo`, `seo-audit`, `ai-seo`, `aso`, `content-strategy`, `social`, `community-marketing`, `public-relations`, `directory-submissions`, `launch`. Tools: Google Search Console + Play Console (free), the app's own engine (pSEO generation), free keyword tools, ChatGPT/Claude for drafting, a scheduler for social.

---

## 5. Activation — how a new user gets a valued experience

**This is the #1 unblock.** Pre-launch with no instrumentation means we are flying blind. Nothing else in this plan can be optimized until activation is measured.

### Current state
Onboarding + SavedBirthDetails exist; "activation" is undefined and unmeasured. No analytics.

### The plan
**Ac1 — Instrument first (Week 1).** GA4 + a product-analytics tool (PostHog free tier). Define the funnel: visit → signup → birth details → **first meaningful reading** → return Day-2 → paid.

**Ac2 — Define the activation event.** Proposed: *"generated a first kundli OR received the first daily briefing OR completed a first matching within session 1."* Time-to-value target: **< 3 minutes**, with birth details captured once and reused everywhere (already built).

**Ac3 — Engineer the "aha" = accuracy + transparency.** The Show-Your-Work panel ("based on Saturn in your 7th + active Venus dasha") is the activation moment that no competitor delivers — surface it prominently on the first reading.

**Ac4 — Soft profile gate.** First meaningful reading prompts profile completion (the `isProfileComplete()` path) — capture birth details as the price of value, not as a wall before value.

**Ac5 — Paywall design.** Keep the free tier genuinely useful (tools free). Premium gates *unlimited chat* + forward-looking features. Test trial length and the value-moment trigger ("you just got a great free reading — unlock unlimited"). Use `paywalls` skill discipline: in-product upgrade *after* value, never before.

**Ac6 — Android onboarding parity.** The Play Store install → first-reading funnel must be as short as web; instrument it separately (install → open → activation).

### 90-day moves
Instrument + define activation (Wk 1–2) → ship Show-Your-Work on first reading + welcome state (Wk 3–4) → Android onboarding parity + paywall trigger test (Wk 5–8) → iterate activation rate, first paywall A/B (Wk 9–12).

### 12-month outlook
Activation rate becomes the north-star input for Q1–Q2; once it's stable and >~25–30%, acquisition spend (organic effort, later paid) is justified to pour on top.

### Skills + tools
`onboarding`, `signup`, `paywalls`, `cro`, `customer-research`. Tools: GA4, PostHog (free), App/Play billing analytics.

---

## 6. Retention — how a converted user stays and deepens

Retention is where a subscription app lives or dies, and it's our structurally strongest hand: the daily briefing gives a *reason to open daily*, and memory gives a *reason no competitor can match*.

### Current state
Daily-briefing engine built (and just made timezone-correct). Lifecycle email/push thin. Memory/continuity designed.

### The plan
**R1 — The daily briefing is the retention spine.** Push + WhatsApp + (optional) email. It's the habit loop — protect and polish it. Personalization (real gochar/transit) is already shipping.
**R2 — Memory / continuity (the moat).** The AI remembering life context across sessions ("you asked about a job in March — how did it go?") is a retention mechanic no human marketplace can replicate. User-visible/editable ("what I remember about you") keeps it trust-positive.
**R3 — Lifecycle email/push sequences.** Welcome series → feature-discovery ("you haven't tried Matching / Palmistry / Decision Room") → value-moment nudges → win-back. Use a free/cheap sender (Resend / Customer.io free tier).
**R4 — Proactive re-engagement.** Cosmic Calendar alerts ("Sade Sati phase 2 starts next month — here's the remedy") are proactive, on-brand reasons to return.
**R5 — Churn prevention.** Subscription preference center, **pause** instead of cancel, honest save-offers (no fear). Recover failed payments (dunning) — pure margin.

### 90-day moves
Welcome + daily-briefing push live (Wk 3–4) → feature-discovery sequence + WhatsApp daily (Wk 5–8) → win-back + pause/save flow + dunning (Wk 9–12).

### 12-month outlook
By Q2 you'll have your first real retention curve; Q3–Q4 deepen with memory-driven personalization and Cosmic-Calendar proactive alerts. Target: D30 retention and monthly subscriber churn as headline metrics (see §13).

### Skills + tools
`emails`, `churn-prevention`, `sms` (WhatsApp framing), `onboarding`. Tools: Resend/Customer.io, push (FCM via Android), WhatsApp Cloud API.

---

## 7. Referral — how retained users bring more users

Relationship astrology is inherently two-person, which makes referral a *product feature*, not a bolt-on.

### Current state
None live. Synastry consent-sharing is designed (Move 2, Feature #4).

### The plan
**Rf1 — Consent-based Synastry sharing (the built-in viral loop).** Invite someone to compare charts → they must sign up / submit birth details to see the shared reading → new activated user. This is the cheapest distribution we have and it's intrinsic to the use case (matching, friendship/co-founder/partner compatibility).
**Rf2 — Share-a-reading / share-a-month.** Beautiful OG-image shares of a reading (the daily, a compatibility score) — designed to be screenshotted and forwarded on WhatsApp/Instagram.
**Rf3 — Two-sided referral.** Give Premium days, get Premium days. Keep incentives honest and simple.

### 90-day moves
Ship Synastry share loop (Wk 5–8) → share-a-reading OG images + first referral mechanic (Wk 9–12).

### 12-month outlook
Referral becomes a measurable acquisition channel by Q2–Q3 (target: a meaningful share of new signups invited by existing users). It compounds with retention — only happy daily-active users refer.

### Skills + tools
`referrals`. Tools: the Synastry invite system, WhatsApp share, dynamic OG-image generation.

---

## 8. Revenue — pricing, packaging, monetization

Move 1 is messaging-and-proof, **not** a price change. The revenue moves here are about *packaging and cash efficiency*, which matter enormously to a bootstrapped runway.

### Current state
₹499/mo, ₹4,999/yr. Razorpay/Stripe + credits live. Annual not defaulted.

### The plan
**Rev1 — Default the annual plan.** ₹4,999/yr (≈ ₹417/mo equivalent, ~2 months free) presented as the default/recommended option. Compresses MRR optics but **improves LTV and brings cash forward** — the single biggest lever for a bootstrapped company's runway. Anchor monthly as the "flexible" option.
**Rev2 — Sharpen the value anchor.** Everywhere price appears: *"₹499 = a whole month, unlimited. On a per-minute app, that's about ten minutes."* This is the meter-never-runs pillar made concrete.
**Rev3 — Tiering.** Free (tools + limited) → Premium (₹499 unlimited). Hold a future **Premium+** (two-way voice, priority, deeper Decision Room) in reserve for when those features are proven — don't over-tier pre-PMF.
**Rev4 — In-product upsells at value moments** (`paywalls`/`offers`): right after a great free reading, not on a cold pricing page.
**Rev5 — NRI / geo pricing.** Diaspora willingness-to-pay (USD/GBP/AED) is materially higher; offer a geo-priced annual for NRI segments once the Android/international push starts (Q3).

### 90-day moves
Default annual + value-anchor copy across pricing/paywall (Wk 5–8) → first upsell-at-value-moment test (Wk 9–12).

### 12-month outlook
Annual-default + NRI geo-pricing are the two revenue step-functions for the year. Track ARPC, annual-plan mix, and (once cohorts exist) LTV. The budget math in §10 is gated on these.

### Skills + tools
`pricing`, `offers`, `paywalls`. Tools: Razorpay/Stripe, App/Play billing.

---

## 9. 90-day roadmap (solo founder — owner is "Founder + AI/skills" unless noted)

AARRR-tagged. The sequencing principle (per the founder's Q1 call = **acquisition first**): **publish → launch → measure-in-parallel → tighten activation.** Acquisition is the headline of every week-block; a *thin* instrumentation layer rides alongside from day one so you always know which top-of-funnel is working — but it never blocks shipping.

### Weeks 1–2 — Open the top of funnel
- **[Acquisition]** Ship programmatic-SEO template #1 (per-sign daily horoscope, EN+HI) + sitemap + Search Console. *(highest priority)*
- **[Acquisition]** Draft Play Store listing (copy, screenshots) + start ASO keyword research.
- **[Acquisition]** Start WhatsApp Cloud API business verification + template approval (long lead time — start early).
- **[Activation — parallel, lightweight]** Drop in GA4 + PostHog and a 5-event funnel (visit → signup → birth details → first reading → D2 return). One afternoon; not a phase.

### Weeks 3–4 — Foundation (publish + distribute)
- **[Acquisition]** Free-tool landing pages (kundli, numerology, mulank) indexable + soft signup gate + OG share images.
- **[Acquisition]** Begin community cadence (Reddit/Quora, 3–5 answers/week) + first short-form videos.
- **[Acquisition]** Expand pSEO: add Hindi + 1–2 more languages; ship sign×sign compatibility cluster.
- **[Activation]** Show-Your-Work prominent on first reading; tighten time-to-value < 3 min (so earned traffic sticks).
- **[Retention]** Welcome email + daily-briefing push live.

### Weeks 5–8 — Velocity
- **[Acquisition]** **Android launch** + ASO live; install→activation instrumented.
- **[Acquisition]** Scale pSEO (add languages; sign×sign compatibility; panchang-by-date).
- **[Referral]** Ship Synastry consent-share loop.
- **[Revenue]** Default annual plan + value-anchor copy.
- **[Acquisition]** Product Hunt + directory submissions; founder short-form 2–3/week.

### Weeks 9–12 — Compound
- **[Retention]** Lifecycle sequences (feature-discovery, win-back) + pause/save + dunning.
- **[Referral]** Share-a-reading OG flow + first referral incentive.
- **[Activation]** First paywall A/B; iterate activation rate.
- **[Revenue]** First upsell-at-value-moment test.
- **[Acquisition]** PR push (anti-Astrotalk angle); WhatsApp daily briefing GA.
- **[Decision gate]** Only if a repeatable activation→paid loop is proven *and* budget exists: a single small paid test (Apple Search Ads or Meta). Otherwise, keep compounding organic.

---

## 10. 12-month outlook (quarterly, tied to capability unlocks)

| Quarter | Theme | Key milestones | Capability gate |
|---|---|---|---|
| **Q1** | Launch + instrument | Web + Android live; funnel instrumented; pSEO foundation shipped; first paying cohort | Bootstrapped / organic-only |
| **Q2** | Prove the loop | SEO pages indexing & compounding; WhatsApp + referral loops live; first retention curve; activation optimized | Still organic; reinvest founder time into winners |
| **Q3** | Compound + international | Scale winning SEO clusters; NRI/international ASO + USD pricing; *if* small raise or MRR allows → first paid test + first contractor (content/video) | **Seed close or ₹X MRR unlocks** first paid + first contractor |
| **Q4** | Second S-curve | New segment or paid channel as the next curve; possible first marketing hire (π-shaped: product-marketing + growth) | Seed deployment unlocks ~₹2–15L/mo paid + first hire |

**Growth-shape honesty.** This is *linear* growth (steady monthly subscriber additions from compounding SEO + referral) punctuated by *step-functions* (Android launch, annual-plan default, NRI pricing, a future paid channel). We are not forecasting exponential. The job of Q1–Q2 is to start the **SEO/content S-curve** and the **retention S-curve**; Q3–Q4 layer the next curve *before* the first plateaus.

**Funding-stage unlocks.** Today (bootstrapped): organic only, founder + AI. At a seed close: ~₹2–15L/mo paid test budget + first marketing hire + contractor relationships. The plan is built so that *nothing assumes money that doesn't exist yet* — paid is a gated experiment, not a dependency.

**Budget math (gated on instrumentation).** Until CAC and activation are measured (Wk 1–2), revenue projections are placeholders. Once known, apply the goal-based method (`budget = [(New ARR / (ARPC × 12)) × CAC] / annual-retention`) to size the first paid test. For now: the "budget" is **founder hours**, allocated ~60% to the SEO/content engine, ~25% to activation/retention instrumentation and flows, ~15% to community/short-form. Keep a 10–20% experimental slice (the WhatsApp/voice/AI-SEO bets).

---

## 11. Marketing operations stack

The differentiator of this plan: a **solo founder + the marketing-skills library + a few MCP/API integrations + the product's own engine** can output the work of a 15–20-person marketing org. Mapping by AARRR stage:

| Stage | Skills (execution) | Tools / MCP / engine |
|---|---|---|
| **Acquisition** | `programmatic-seo`, `seo-audit`, `ai-seo`, `aso`, `content-strategy`, `social`, `community-marketing`, `public-relations`, `directory-submissions`, `launch` | Search Console, Play Console, **the app's own deterministic engine (pSEO generation)**, free keyword tools, ChatGPT/Claude (drafting), social scheduler |
| **Activation** | `onboarding`, `signup`, `paywalls`, `cro` | GA4, PostHog (free tier), App/Play billing |
| **Retention** | `emails`, `churn-prevention`, `sms` | Resend / Customer.io (free tier), FCM push, WhatsApp Cloud API |
| **Referral** | `referrals` | Synastry invite system, dynamic OG images, WhatsApp share |
| **Revenue** | `pricing`, `offers` | Razorpay / Stripe, App/Play billing |
| **Cross-cutting** | `copywriting`, `copy-editing`, `marketing-psychology`, `customer-research`, (`ads`, `ad-creative` — *later*) | i18n parity system (12-language content multiplier) |

**Capability unlocks by funding stage.** Bootstrapped → everything above, organic. Seed close → add `ads` + `ad-creative` (paid tests), first π-shaped hire, niche contractor for video/content. The unique force-multiplier here is the **engine + i18n**: it turns one founder's content effort into 12 languages of indexable pages automatically.

---

## 12. Tactical idea bank (cross-referenced to AARRR + status)

Status legend: **Now** (next 90 days) · **Q2** · **Q3+** (needs a little budget/scale) · **Q4+** (needs a raise) · **Skip** (conflicts with brand voice or model).

This is filtered for a bootstrapped, solo, pre-launch app — the value is as much in the **Skip** column (what *not* to do) as in the Now column.

| Category (idea range) | Highest-value moves for us | Status | Stage |
|---|---|---|---|
| **Content & SEO (1–10)** | Programmatic page generation from the engine; pillar explainers ("what is sade sati / kundli matching"); topic clusters per tradition | **Now** | Acq |
| **Competitor & Comparison (11–13)** | "MyAstro360 vs Astrotalk" (meter vs flat), "vs Astrosage" (beautiful + transparent vs cluttered) comparison pages | **Now** | Acq |
| **Free Tools & Engineering (14–22)** | Free kundli / numerology / mulank / matching / panchang as indexable, shareable lead magnets | **Now** | Acq/Act |
| **Paid Advertising (23–34)** | Apple Search Ads / Meta — **one small gated test only after the loop is proven** | **Q3+** | Acq |
| **Social & Community (35–44)** | Reddit/Quora authentic answers; Vedic FB groups; founder short-form video; build-in-public | **Now** | Acq |
| **Email Marketing (45–53)** | Welcome series, feature-discovery, win-back, daily-briefing digest | **Now/Q2** | Ret |
| **Partnerships & Programs (54–64)** | Co-marketing with adjacent wellness/tarot creators; affiliate later | **Q2/Q3+** | Acq/Ref |
| **Events & Speaking (65–72)** | Webinars/AMAs ("how astrology math actually works") — low-cost only | **Q3+** | Acq |
| **PR & Media (73–76)** | Anti-Astrotalk / no-fear-selling / privacy story to YourStory, Inc42; HARO-style | **Now/Q2** | Acq |
| **Launches & Promotions (77–86)** | Product Hunt; Android Play Store launch; directory submissions; **honest** launch (no fake scarcity) | **Now** | Acq |
| **Product-Led Growth (87–96)** | Synastry share loop; share-a-reading; daily-briefing virality; free-tool→signup | **Now** | Ref/Act |
| **Content Formats (97–109)** | Short-form video, carousels, OG-image shares, explainer threads | **Now/Q2** | Acq |
| **Unconventional & Creative (110–122)** | "Show your work" as a content series (debunk a fear-selling reading publicly) | **Q2** | Acq |
| **Platforms & Marketplaces (123–130)** | Play Store (Now), App Store (later), AI/astrology directories | **Now/Q3+** | Acq |
| **International & Localization (131–132)** | NRI/diaspora English ASO + content; the 12-language engine is the unlock | **Q3+** | Acq/Rev |
| **Developer & Technical (133–136)** | N/A — not a dev tool | **Skip** | — |
| **Audience-Specific (137–139)** | NRI segment landers; relationship-decision segment; "curious skeptic" content | **Q2/Q3+** | Acq |

**Explicit skips (and why):** fear/doom urgency, fabricated testimonials or fake astrologer personas, countdown false-scarcity, "astrologer is typing…" theatrics, gemstone-fear upsells, and a human per-minute marketplace — **all Skip**, permanently. They would each generate short-term conversion at the cost of the exact trust thesis the brand is built on. Paid ads, conferences, and hiring are **deferred** (not skipped) until a raise or proven loop.

---

## 13. Measurement, RACI, open decisions, appendix

### North-star + leading indicators
- **Q1 north-star (acquisition-first, founder's call):** **organic reach** — indexed pages + organic clicks (Search Console) + Play Store installs — with **activation rate** (signup → first meaningful reading) watched as the *guardrail* so growth never pours into a leaky funnel. Target: a repeatable traffic → signup → first-reading loop + the first 100 paying subscribers.
- **Steady-state north-star:** **Net paying-subscriber growth** with **LTV:CAC > 3**.
- **Leading indicators by stage:** Acquisition → indexed pages + organic impressions/clicks (Search Console), Play Store installs. Activation → activation rate, time-to-value. Retention → D7/D30 retention, daily-briefing open rate, monthly churn. Referral → % of signups invited, Synastry invites sent/accepted. Revenue → trial→paid, annual mix, ARPC.

### RACI (solo founder reality)
| Function | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Strategy / positioning | Founder | Founder | fCMO/this plan | — |
| SEO/content engine | Founder + `programmatic-seo`/`ai-seo` | Founder | — | — |
| Activation/analytics | Founder + `onboarding`/`cro` | Founder | — | — |
| Lifecycle/retention | Founder + `emails`/`churn-prevention` | Founder | — | — |
| Paid (later) | *first contractor* | Founder | — | — |

**First-hire note (when funded):** a **π-shaped** marketer (Product Marketing + Growth, or Growth + Content), titled Lead/Manager — not VP/CMO. Until then, contractors for execution (video editor, content) before any FTE.

### Open decisions (ranked by impact)
1. **CAC + activation rate are unknown.** *Every projection depends on this.* Resolve in Wk 1–2 by instrumenting. **(Highest.)**
2. **Activation-event definition** — confirm "first meaningful reading" boundary and measure baseline.
3. **Free/paid feature boundary** — exactly which features gate (chat? Decision Room? Cosmic Calendar? voice?).
4. **Annual-vs-monthly default** — confirm defaulting annual (recommended) and the discount framing.
5. **NRI geo-pricing** — USD/GBP/AED annual: yes/no and when (recommend Q3).
6. **Android launch date precision** — pins the Wk 5–8 ASO/launch block.
7. **WhatsApp Meta approval lead time** — start now; may slip the WhatsApp loop.
8. **Confirm north-star** — paid-subscriber growth vs install/MAU (this plan assumes paid-subscriber growth; flag if you'd rather optimize install base first).

### Appendix
- Strategic source: in-repo plan `make-plan-for-move-glittery-penguin.md` (Moves 1–3 + 7 differentiator features) — this marketing plan is the GTM layer over that product roadmap.
- Research record: `research.md` (this plan folder).
- Deeper per-channel work, when you want it, lives in the matching skills: `programmatic-seo`, `aso`, `onboarding`, `paywalls`, `emails`, `referrals`, `pricing`, `public-relations`.

---

### Changelog
- **2026-06-25 (v1.1):** Codebase audit recalibrated §3. The programmatic-SEO engine and GA4 wiring were
  assumed near-empty in v1; they are substantially built. Re-scored SEO 2→4, Sales/product 2→3,
  Conversion 2→3, CRO 2→3 (total 37→42). Reframed the acquisition spine from "build the engine" to
  "extend coverage + measure + convert." Shipped the activation funnel instrumentation (GA4 + PostHog).

---

*Prepared 2026-06-24 · v1.1 (2026-06-25) · MyAstro360 · bootstrapped / pre-launch / solo-founder / Android-imminent.*
