# MyAstro360 — Marketing Measurement Plan

**Owner:** Solo founder
**Last updated:** 2026-06-25
**Stage:** Bootstrapped, pre-launch / private beta. Q1 priority = **acquisition**.
**Sinks:** GA4 (`window.gtag`) + PostHog (`window.posthog`), both fired from one call via `apps/web/src/lib/analytics.ts`.

This plan documents what we measure, why, where each event fires, and how to read it. It reflects what is **live in code today** — no aspirational events are listed as if shipped, and no numbers are invented. Targets are intentionally left as `TBD (set after 2–4 weeks of baseline)`.

Brand-voice guardrail for everything below: we measure honestly. No vanity dashboards, no metric is reported in marketing without the query behind it. The product promise ("the meter never runs", "same math every time", "shows its work") extends to our own analytics — we show our work.

---

## 1. The funnel & north-star

### The funnel

```
        VISIT  ──►  SIGN UP  ──►  PROFILE COMPLETED  ──►  FIRST READING  ──►  SUBSCRIPTION
      (organic     (sign_up,      (profile_completed)     (first_reading       (purchase /
       reach)       + identify)                            = ACTIVATION)        plan_selected)
```

| Stage | Definition | Primary event(s) | Sink of record |
|-------|------------|------------------|----------------|
| Visit | A session lands on web (or, later, opens the Android app) | GA4 auto pageview / PostHog `$pageview` | GA4 (acquisition) |
| Sign up | Account created on any of 3 auth paths | `sign_up` (+ `identify`) | both |
| Profile completed | User saves birth details (the input the engine needs) | `profile_completed` | both |
| **First reading (ACTIVATION)** | See definition below | `first_reading` | both (PostHog of record) |
| Subscription | User starts/completes a paid plan | `plan_selected` → `checkout_started` → `purchase` | both (server truth = follow-on) |

### Activation definition (explicit)

> **Activation = the first time a signed-in user generates real astrological output** — defined in code as the **first of**: a kundli generation **or** a chat message answered **or** a daily briefing loaded, **per browser**.

Implementation: fired via `trackOnce("first_reading", "first_reading", { surface })` so a refresh or a repeated action never double-counts. `surface` ∈ `{ kundli, chat, daily_briefing }`. The de-dupe key is **per browser (localStorage)**, not per server-side user — a known limitation (see §6: a user on two devices can fire activation twice; server-truth activation is a follow-on).

**Activation rate = `first_reading` users ÷ `sign_up` users** over a fixed cohort window (use signup-day cohort, measured at D7 so slow activators are counted).

### North-star

**Q1 north-star — Organic reach.** Because Q1 is acquisition and we are pre-launch/bootstrapped with a ~500-URL programmatic SEO engine already built, the single number that best captures "are more of the right people finding us" is organic reach, composed of:

- **Indexed pages** (Google Search Console — Pages report, "Indexed" count)
- **Search Console clicks** (GSC Performance — total clicks, 28-day trailing)
- **Play Store installs** (Play Console, once the Android app ships in 1–3 months)

**Guardrail on the north-star: activation rate.** Reach is worthless if arrivals don't activate. We never celebrate a clicks increase whose cohort activation rate fell. Reach goes up *and* activation rate holds/improves, or it doesn't count.

**Steady-state north-star (post-acquisition phase):** **net paying-subscriber growth** (new paid − churned paid), with **LTV:CAC > 3** as the health gate. At ₹499/mo or ₹4,999/yr with zero marginal cost per chart, contribution margin is ~100% of revenue, so LTV is driven almost entirely by retention months — which is exactly why PostHog retention cohorts (below) are load-bearing.

---

## 2. Tracking plan (live events)

Every event below is **live in code today**. Naming reflects the actual strings passed to `track()` — they are kept as-is for continuity even where they diverge slightly from object_action convention (e.g. `purchase`, `sign_up`). **Do not rename live events without a migration** — historical data keys on the string.

All events fan out to **both** sinks unless noted; the sink column states the analytical system of record for that event.

| Event | Fires where (file) | Key properties | Sink (system of record) | Funnel stage |
|-------|--------------------|----------------|-------------------------|--------------|
| `sign_up` | `app/auth/page.tsx` — 3 paths (firebase, otp, password); fired via `trackOnce("signup:<userId>")`; `identify(userId)` immediately precedes it | `method` ∈ `{ firebase, otp, password }` | both (GA4 = acquisition attribution) | Sign up |
| `profile_completed` | `app/profile/page.tsx` on successful birth-detail save | — (none today) | both | Profile completed |
| `first_reading` | `app/kundli/KundliClient.tsx`, `app/chat/page.tsx`, `app/my-day/page.tsx`; fired via `trackOnce("first_reading", …)` | `surface` ∈ `{ kundli, chat, daily_briefing }` | **PostHog** (activation funnel) | **Activation** |
| `kundli_generated` | `app/kundli/KundliClient.tsx` after each successful chart | `tradition` (active tradition) | PostHog (feature usage) | Engagement |
| `chat_message_sent` | `app/chat/page.tsx` after each answered message | `category` (selected chat category) | PostHog (feature usage) | Engagement |
| `pricing_viewed` | `app/pricing/page.tsx` on mount | — | both (GA4 = intent signal) | Consideration |
| `plan_selected` | `app/pricing/page.tsx` when a plan CTA is clicked | `plan` (e.g. `monthly` / `annual`) | both | Consideration → checkout |
| `checkout_started` | `app/checkout/page.tsx` when Razorpay opens | `product`, `kind`, `amount` | both (PostHog = revenue funnel) | Checkout |
| `purchase` | `app/checkout/page.tsx` on Razorpay verify success | `product`, `kind`, `amount` | both (client-side today — see §6 for server truth) | Subscription / revenue |
| `paywall_view` | `components/paywall/UpgradePrompt.tsx` on open | `trigger` | PostHog (paywall funnel) | Monetization prompt |
| `paywall_click` | `components/paywall/UpgradePrompt.tsx` CTA | `trigger`, `cta` ∈ `{ primary, secondary }` | PostHog | Monetization prompt |
| `paywall_dismiss` | `components/paywall/UpgradePrompt.tsx` on close | `trigger` | PostHog | Monetization prompt |
| `share_clicked` | `components/share/ShareButton.tsx` | `trigger`, `method` ∈ `{ native, whatsapp, copy }` | PostHog (referral/virality) | Referral |

**Identity:** `identify(userId)` is called on each auth success (sets GA4 `user_id` and PostHog person id). PostHog anonymous → identified stitching happens here; before `identify`, programmatic-SEO crawler and anonymous traffic stay anonymous (no person profile created), which keeps the PostHog person count clean.

### Property hygiene rules (enforce going forward)

- **No PII in properties.** `userId` goes only through `identify()`, never as an event prop. Never pass email/phone/name/birth details as properties.
- **`amount` is a number** (paise/rupee value as passed by checkout) — keep it numeric so PostHog/GA4 can sum it.
- **Enumerate, don't free-text.** `surface`, `method`, `trigger`, `cta`, `tradition`, `category` should stay low-cardinality enums.
- **New events must be added to this table in the same PR.** The table is the source of truth; an event not in this table is a bug.

---

## 3. GA4 vs PostHog — division of labor

We deliberately run both and fire identical event names to both. They answer different questions; do not duplicate analysis across them.

| | **GA4** | **PostHog** |
|---|---------|-------------|
| Primary job | **Acquisition & attribution** — where traffic comes from | **Product funnels, retention, session insight** |
| Owns | Source / medium / campaign, channel grouping, landing pages, **Search Console link**, geo (NRI vs India split), device | Activation funnel, **retention cohorts (D1/D7/D30)**, paywall funnel, revenue funnel, session replay, feature usage |
| North-star metrics it serves | Organic reach (paired with GSC), CAC inputs once paid spend starts | Activation rate (guardrail), retention (LTV driver), free→paid conversion |
| Key strength here | Native Search Console integration; the ad-platform attribution layer when paid begins | Person-level funnels with breakdown by `surface`/`method`; cohort retention without SQL |
| Read it when | "Which channel/page is driving signups?" "Are indexed pages converting to clicks?" | "Do signups activate?" "Do activated users come back?" "Where does the paywall leak?" |

Rule of thumb: **GA4 answers "did the right people arrive and from where", PostHog answers "did they activate and stay".** Revenue truth is neither today — it is a client-side `purchase` event and should migrate to a server webhook (§6).

---

## 4. First dashboards to build

Build these five first; ignore everything else until they exist.

### PostHog

1. **Activation funnel**
   `sign_up` → `profile_completed` → `first_reading`.
   - Breakdown `first_reading` by `surface` to see which first experience activates best (kundli vs chat vs daily briefing).
   - Conversion window: 7 days. This funnel's bottom step **is** the activation-rate guardrail.

2. **Retention cohort — D1 / D7 / D30**
   Retention insight, signup cohort. Returning event = any of `first_reading` / `kundli_generated` / `chat_message_sent` / a `$pageview` while identified.
   - This is the LTV driver. For a flat-unlimited product, retention curve shape ≈ subscription survival.

3. **Revenue funnel**
   `pricing_viewed` → `plan_selected` → `checkout_started` → `purchase`, plus a parallel **paywall funnel** `paywall_view` → `paywall_click` → (`checkout_started` → `purchase`). Breakdown paywall by `trigger` to find which in-product moment monetizes.

### GA4

4. **Acquisition by source / medium**
   Standard Traffic acquisition report, conversion = `sign_up`. Segment organic vs direct vs referral; add a geo split (India vs NRI English-speaking markets) since ICP spans both.

5. **Search Console integration**
   Link GSC to GA4 (Admin → Product links → Search Console) and surface the GSC channel. Pair with the GSC Performance/Pages reports for the two north-star inputs (indexed pages, clicks). This dashboard is the Q1 north-star's home.

---

## 5. How to activate

### Vercel env vars (web app)

Set these in the Vercel project → Settings → Environment Variables (Production + Preview). Each sink is gated on its key, so until set, calls are silent no-ops.

| Var | Purpose | Notes |
|-----|---------|-------|
| `NEXT_PUBLIC_GA_ID` | GA4 Measurement ID | Format `G-XXXXXXXXXX`, from the GA4 web data stream |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | Project Settings → API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingestion host | Defaults to `https://us.i.posthog.com`; set to `https://eu.i.posthog.com` if EU project |
| `NEXT_PUBLIC_GSC_VERIFICATION` | Search Console meta-tag verification | The token from GSC's "HTML tag" verification method |

After setting: redeploy, then confirm in **GA4 DebugView** (real-time) and **PostHog → Activity** that `sign_up`, `profile_completed`, and `first_reading` arrive with the expected properties. Validate on both desktop and mobile web before trusting the funnel.

### Google Search Console setup

1. Add property in GSC (domain property preferred so all subdomains/locales are covered).
2. Verify via the meta tag using `NEXT_PUBLIC_GSC_VERIFICATION` (already wired into the app head).
3. Submit the sitemap(s) for the ~500 programmatic URLs and the 13 locales.
4. Confirm the **Pages** report shows pages moving to "Indexed" (north-star input #1) and **Performance** accrues clicks (input #2).
5. Link GSC → GA4 (see §4, dashboard 5).

### Play Console setup (when Android ships, 1–3 mo)

1. Create the app in Play Console; complete store listing (ASO is out of scope here).
2. Wire a GA4 Android data stream (Firebase) so installs and in-app events land in the same GA4 property as web — keeps acquisition unified.
3. Track **installs** (north-star input #3) and define **install → first_reading** as the mobile activation funnel (the Android event must map to the same `first_reading` semantics — see §6).

---

## 6. Instrumentation follow-ons

Ordered by leverage. None of these is shipped; do not report their metrics as live.

1. **Server-truth revenue events (highest priority).**
   `purchase` fires **client-side** on Razorpay verify today, so it misses purchases where the browser closes before the callback and can be spoofed. Move revenue truth to the **Razorpay webhook** on the NestJS API (`payment.captured` / `subscription.charged` / `subscription.cancelled`). Land these in the **existing unused server-side ClickHouse stub** as the durable revenue/event store, and/or forward server-side to PostHog. This makes LTV:CAC and net-paying-subscriber growth trustworthy and gives us churn/renewal events the client can never see.

2. **Server-truth activation.**
   `first_reading` de-dupes per browser (localStorage), so multi-device users can double-count and a cleared browser re-fires. Add a server-side first-reading flag keyed on `userId` (write once) and emit the canonical activation event from the API. Keep the client event for speed; reconcile against server truth.

3. **Android install → activation.**
   Ensure the Android app fires the **same** `sign_up` / `profile_completed` / `first_reading` events (same names, same `surface` enum) into the shared GA4 property and PostHog, so the activation funnel and retention cohorts are platform-agnostic. Map Play install as the top of the mobile funnel.

4. **Search Console + Play Console as data sources, not just dashboards.**
   Pull GSC clicks/impressions and Play installs on a schedule (export or API) into the weekly review so the north-star is one assembled number, not three tabs.

5. **Channel attribution on `sign_up`.**
   Capture first-touch `utm_source/medium/campaign` (and referrer) at signup as identify traits so PostHog funnels can break down activation/retention by acquisition channel — needed before paid spend starts to compute CAC by channel.

---

## 7. Weekly metric-review ritual (solo founder)

A 30-minute Monday review. Same five numbers every week, each with the query/report behind it so the ritual is repeatable and honest. Track trend (vs last week, vs 4-week avg), not just the level.

| # | Number | Source | Why it's on the list |
|---|--------|--------|----------------------|
| 1 | **Organic reach** = indexed pages + GSC clicks (28-day trailing) | GSC Pages + Performance | The Q1 north-star. Is the SEO engine compounding? |
| 2 | **New signups** (by `method`, and organic vs other) | GA4 acquisition + `sign_up` | Top-of-funnel acquisition result of the reach. |
| 3 | **Activation rate** = `first_reading` ÷ `sign_up` (D7 cohort, broken down by `surface`) | PostHog activation funnel | The north-star's **guardrail**. Falling activation cancels any reach win. |
| 4 | **D7 retention** (latest complete cohort) | PostHog retention | The LTV driver; for a flat-unlimited product this *is* the subscription survival signal. |
| 5 | **Net new paying subscribers** = new paid − churned paid | `purchase` today → Razorpay webhook once §6.1 ships | Steady-state north-star; the only number that pays the bills. |

Rules for the ritual:
- **One decision per review.** The output is a single change to make this week, not a status report to nobody.
- **Pair reach with activation every time** (rows 1 and 3 read together). Never act on one without the other.
- **Don't invent precision.** Until ~2–4 weeks of baseline exist, record levels and look at direction; set targets only once a baseline is real.
- When `purchase` is still client-side, footnote row 5 as "directional, client-side" — and prioritize §6.1 so it becomes trustworthy.
