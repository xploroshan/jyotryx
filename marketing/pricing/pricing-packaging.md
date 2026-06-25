# MyAstro360 — Pricing & Packaging Playbook

**Product:** MyAstro360 (repo `jyotryx`) — Vedic astrology platform. Deterministic astrology engine + AI layer. Zero marginal cost per chart.
**Stage:** Bootstrapped, pre-launch / private beta, solo founder.
**ICP:** Urban + NRI Indians, 22–38.
**Positioning:** Anti-Astrotalk — *"the meter never runs."* Flat, unlimited access vs. Astrotalk's per-minute meter (~₹500 buys roughly 10 minutes with a consultant).

**Current pricing:**

| | Price | Notes |
|---|---|---|
| Free | ₹0 | Tools (charts, basic calculators) |
| Premium (monthly) | ₹499/mo | Unlimited |
| Premium (annual) | ₹4,999/yr | ≈ ₹417/mo equivalent, ~17% off vs monthly×12 |

Billing: Razorpay subscriptions + credits + one-time entitlements (reports / palmistry).

### Brand voice — hard rules (VETO power over any tactic below)
- **No fear-selling.** We never sell anxiety ("your future is at risk").
- **No fake scarcity / no countdown false-urgency.** No "2 seats left," no fake timers, no manufactured deadlines.
- **No fabricated proof.** No invented testimonials, ratings, or user counts.

Any line or mechanic in this playbook that drifts toward those is dead on arrival. Where this playbook references urgency or scarcity, it means **real** state only (e.g. an annual price that is genuinely changing, a credit balance that is genuinely zero).

---

## 1. Annual-default rationale

**Status: LIVE.** The pricing page (`apps/web/src/app/pricing/page.tsx`) is SiteSettings-driven. Annual is now the **default / recommended** plan: it sits in the centre column with the "popular" badge, driven by the SiteSetting `pricing.recommended` (default `"annual"`). It shows its per-month equivalent (≈ ₹417/mo) plus a computed savings % vs monthly×12. The recommendation is **A/B-tunable with no redeploy** — flip `pricing.recommended` to `"monthly"` to test (see §6).

**Why annual-default is the single biggest runway lever for a bootstrapped, solo-founder company:**

1. **Cash forward = runway.** Annual collects ₹4,999 up front instead of ₹499/mo trickling in. For a bootstrapped founder with no outside capital, **pulling 12 months of cash into month 1 is the difference between funding the next feature and not.** One annual subscriber today funds roughly a year of that user's infra (which is near-zero marginal cost anyway) plus surplus to reinvest. This is the cheapest "financing" available — it's customer-funded and dilution-free.

2. **LTV lift through lower churn.** Monthly plans churn every month — each renewal is a fresh cancel decision. Annual plans churn once a year. An annual subscriber who would have lapsed in month 3 on monthly instead stays paid through month 12. Even at our modest ~17% headline discount, the **retained months more than pay for the discount**: the LTV math favors annual whenever monthly churn is meaningfully above ~3–4%/mo (almost certain pre-PMF). Annual-default also front-loads the commitment decision *once*, when intent and excitement are highest (at purchase), rather than re-litigating it monthly.

3. **Lower payment-failure surface.** One Razorpay charge per year instead of twelve means ~12× fewer involuntary-churn events from card failures — material before any dunning exists (see §7).

4. **Cleaner forecasting.** Annual MRR-equivalent is far more predictable than a stack of monthly subs, which matters when a solo founder is making build-vs-survive calls.

**The discipline:** annual is the *default*, not the *only* option. Monthly stays visible and one click away — defaulting is a nudge, not a trap. We never hide monthly, never pre-tick annual in a way the user can't see and change, and never use a countdown to force the annual choice. The lift comes from **framing annual as the obvious-value choice** (per-month equivalent + honest savings %), not from pressure.

---

## 2. Value-anchor copy bank

The job of every line here: make **"the meter never runs"** concrete by contrasting a flat month of unlimited access against what the same money buys on a per-minute app. All comparisons use **real, checkable** numbers (₹499 ≈ ~10 minutes on a ~₹50/min meter). No fear, no fake scarcity, no invented proof.

> **Anchor fact (the load-bearing comparison):** On a per-minute app, ₹499 buys roughly **ten minutes** with a consultant. On MyAstro360, ₹499 is a **whole month, unlimited.** On annual it's **≈ ₹417/mo** — and the meter still never runs.

### Pricing page

- **Hero / headline:** "The meter never runs. Ask anything, as often as you like."
- **Sub-headline:** "₹499 is a whole month, unlimited. On a per-minute app, that's about ten minutes."
- **Annual badge line:** "Best value — works out to ≈ ₹417/mo."
- **Annual savings line (computed):** "Pay yearly, save {savings%} vs paying monthly."
- **Reassurance under CTA:** "No meter. No per-minute charges. Cancel anytime."
- **Free→Premium bridge:** "You've been using the tools for free. Premium just removes the ceiling — unlimited questions, every chart, no clock."

### Checkout

- **Order-summary line (annual):** "MyAstro360 Premium — 12 months. ≈ ₹417/mo, billed ₹4,999 once."
- **Order-summary line (monthly):** "MyAstro360 Premium — ₹499/mo. Cancel anytime."
- **Switch-to-annual nudge (shown on the monthly path, honest, no pressure):** "Prefer to pay once? Annual is ≈ ₹417/mo — save {savings%}." (No timer. The offer is always there.)
- **Trust footer:** "Secure payment via Razorpay. The meter never runs — your plan is flat and unlimited."

### Paywall (in-product, via `UpgradePrompt`)

- **Headline (credit-exhaustion moment):** "You've hit the free limit. On Premium, the meter never runs."
- **Body:** "Unlimited questions for ₹499/mo — about what ten minutes costs on a per-minute app. Or ≈ ₹417/mo on annual."
- **Primary CTA:** "Go unlimited"
- **Secondary / dismiss:** "Not now"
- **Microcopy under CTA:** "Flat price. No per-minute meter. Cancel anytime."

**Voice guardrails for this bank:** every comparison is to a *category* ("a per-minute app"), stated as an approximate, checkable fact — not a named competitor smear and not a fabricated stat. Never pair these lines with a countdown or a "limited spots" claim.

---

## 3. Paywall trigger → message map

Each row is an in-product value moment — a point where the user has *already felt the value* and hit a real ceiling. The chat-credit-exhaustion paywall is **LIVE** via the reusable `components/paywall/UpgradePrompt.tsx` (fires `paywall_view` / `paywall_click` / `paywall_dismiss`). Feature gates throw **402** (reports / palmistry) and route to `/checkout`. The other rows below are the build-out plan for the same component.

| Trigger | When | Message framing | CTA | Analytics |
|---|---|---|---|---|
| **Chat credits exhausted** *(LIVE)* | Chat API returns `400 "Insufficient credits"`; `UpgradePrompt` renders inline at the moment of exhaustion | "You've hit the free limit. On Premium, the meter never runs — unlimited questions, ₹499/mo (≈ ₹417/mo annual)." | "Go unlimited" / "Not now" | `paywall_view`, `paywall_click`, `paywall_dismiss` → `checkout_started` → `purchase` |
| **Kundli / report gate** | User requests a gated report/palmistry; feature gate throws **402** → `/checkout` | "Your full report is ready to generate. Unlock it with Premium — or buy this one report as a one-time." (Offer both: subscription *and* one-time entitlement.) | "Unlock with Premium" / "Buy this report" | `paywall_view`, `paywall_click`, `checkout_started`, `purchase` |
| **Decision Room** | User opens / tries to run a Decision Room session beyond free allowance | "Decision Room thinks through a real choice with you, end to end. Premium keeps the room open — no clock, no meter." | "Open with Premium" / "Maybe later" | `paywall_view`, `paywall_click`, `paywall_dismiss`, `purchase` |
| **Daily-briefing depth** | Free user taps to expand the deeper / personalised layer of the daily briefing | "Want the full read on today? Premium gives you the deeper daily briefing every morning — flat price, no meter." | "Get the full briefing" / "Not now" | `paywall_view`, `paywall_click`, `paywall_dismiss`, `purchase` |

**Implementation note:** all four reuse `UpgradePrompt` with a `trigger`/`context` prop so the same component carries different copy and the same event names with a distinguishing property (e.g. `trigger: "chat_credits" | "report_gate" | "decision_room" | "daily_briefing"`). That keeps the funnel analysis clean: one set of events, segmentable by trigger, so we can see *which value moment converts best* (feeds §6).

**Framing discipline across all rows:** the paywall always appears *after* value is felt, names the real ceiling honestly, and offers the unlimited frame. No row uses fear ("you'll miss something important") or fake scarcity. The report-gate row deliberately offers the **one-time entitlement alongside** the subscription — capturing the user who isn't ready to commit without forcing the choice.

---

## 4. Tiering

**Ship with two tiers. Hold the third in reserve.**

### Free — "Tools"
- Charts, basic calculators, a metered allowance of chat / daily-briefing.
- Purpose: deliver real standalone value so the user experiences the product *before* any paywall. The Free tier is the top of the funnel and the credibility anchor — it must be genuinely useful, not crippleware.

### Premium — ₹499/mo or ₹4,999/yr (annual default)
- The headline promise: **the meter never runs.** Unlimited chat, every chart, full reports access, deeper daily briefing, Decision Room.
- One simple, unlimited tier is the entire positioning. Resist the urge to fragment "unlimited" — the moment we add usage caps to Premium, we *become* the meter we're positioned against.

### Premium+ — **held in reserve (do not build pre-PMF)**
- Candidate differentiators for *later*: two-way voice conversations, priority compute/queue, deeper Decision Room (longer-horizon, multi-scenario), early access to new modules.
- **Why hold it:** pre-PMF, every extra tier splits attention, dilutes the "one flat unlimited price" story, and creates packaging decisions we don't yet have the willingness-to-pay data to make well. Add Premium+ only once (a) Premium is converting and retaining, and (b) we have a genuinely premium capability (voice is the leading candidate) that a real segment is asking to pay more for.

**Discipline: don't over-tier before product-market fit.** Two tiers — Free and one unlimited Premium — is the right surface area for a solo founder pre-launch. One-time entitlements (reports / palmistry) already give us a low-commitment monetization path *without* adding a subscription tier. The value metric is deliberately **not** usage (that's the meter we reject) — it's **access**: Free = tools, Premium = the meter never runs.

---

## 5. NRI geo-pricing plan (USD / GBP / AED annual)

**Status: NOT YET — planned for Q3 international push. Flagged, not live.**

**Rationale.** A large slice of the ICP is NRI (US, UK, Gulf). For them, ₹4,999/yr converts to a *very* low number (~$60) — which both leaves money on the table and can read as "cheap / low-trust" in a high-cost market. Localised pricing in the user's own currency (a) raises captured value where willingness-to-pay is genuinely higher, (b) removes the FX/"foreign card" friction at Razorpay checkout, and (c) signals that we built for them, not just for India. We lead with **annual** internationally for the same runway + retention reasons as §1.

**Rough anchors (annual, directional only — validate before launch):**

| Region | Currency | Rough annual anchor | Notes |
|---|---|---|---|
| US / global | USD | ~$79–99/yr | Anchors against US astrology-app subscriptions, which run higher; still far under per-session consultant pricing. |
| UK / EU | GBP | ~£69–79/yr | Mirror USD logic at local price points. |
| Gulf (UAE etc.) | AED | ~AED 299–349/yr | Large, high-income NRI concentration; AED pricing removes conversion friction. |

These are **anchors to test, not commitments.** Method before launch: light willingness-to-pay read on the NRI segment (even informal beta interviews), competitor scan in each market, then set with monthly counterparts at a consistent ~17% annual discount. **Same brand voice applies globally** — "the meter never runs" translates directly; no fear-selling, no fake scarcity, in any currency. Keep monthly available in each currency; keep annual the default.

**Build dependency:** requires currency detection + multi-currency Razorpay (or an international PSP) + SiteSettings-driven per-region price strings. Treat as a Q3 epic, gated behind Indian-market PMF signal.

---

## 6. First 3 A/B tests (once traffic exists)

We have the events live to run these honestly: `pricing_viewed`, `plan_selected`, `checkout_started`, `purchase` (revenue funnel) and `paywall_view` / `paywall_click` / `paywall_dismiss` (in-product). **Do not run any of these until traffic is high enough to reach a pre-committed sample size** — pre-launch/private-beta volume will mostly produce noise. Decide the minimum sample size and runtime *before* starting each test, pick one primary metric per test, and don't peek-and-stop early.

| # | Test | Variants | Primary metric | Supporting events | Mechanism |
|---|---|---|---|---|---|
| **1** | **Annual-default vs monthly-default** | A: `pricing.recommended = "annual"` (current) · B: `= "monthly"` | Revenue per visitor (blended) — *not* raw conversion rate, since annual and monthly carry different cash value | `pricing_viewed`, `plan_selected` (by plan), `purchase` (by plan & amount) | Flip the existing SiteSetting — **no redeploy**. This is the cleanest test we have wired. |
| **2** | **Value-anchor copy on/off** | A: pricing/checkout/paywall with the "ten minutes / meter never runs" anchor (§2) · B: plain feature/price copy, no comparison | Visitor → `purchase` conversion | `pricing_viewed` → `checkout_started` → `purchase`; `paywall_view` → `paywall_click` | Tests whether the concrete value anchor actually moves money vs. just reads nicely. |
| **3** | **Paywall trigger timing** | A: paywall fires *at* credit exhaustion (current LIVE behaviour) · B: a soft heads-up one interaction *before* the hard limit | `paywall_click` rate, then downstream `purchase` | `paywall_view`, `paywall_click`, `paywall_dismiss`, `checkout_started`, `purchase` | Earlier warning may convert better *or* may annoy and raise `paywall_dismiss` — measure both. |

**Sample-size discipline (non-negotiable):**
- Fix the minimum sample size and run-length **before** launching each test; calculate from a realistic baseline conversion and a meaningful minimum detectable effect.
- One primary metric per test (listed above). Supporting events are for diagnosis, not for declaring winners.
- No early stopping on a good-looking peek; no re-slicing until something looks significant.
- Run tests **sequentially**, not stacked, until traffic is large enough to isolate effects — overlapping tests on low volume will confound each other.
- Test 1 first (highest leverage, zero-build, directly tied to the §1 runway thesis).

---

## 7. Deferred build

Both items are **acknowledged gaps, deliberately deferred** — not oversights. Flagged here so they're not forgotten when traffic and paid volume arrive.

### a. Subscription-management UI (cancel / pause)
- **Today:** no self-serve subscription management.
- **Why it matters:** users *must* be able to cancel easily — it's table-stakes trust, it's expected by Razorpay/consumer norms, and (counter-intuitively) **easy cancellation reduces chargebacks and protects the brand.** A frictionless, no-dark-pattern cancel flow is squarely on-brand. Pause is a softer retention lever than cancel and is worth building alongside.
- **Build when:** before broad public launch, or as soon as the first cohort approaches renewal — whichever comes first. A cancel path that hides the button or guilt-trips the user is a brand-voice violation; build it clean.

### b. Dunning on `payment.failed`
- **Today:** no dunning. A failed Razorpay charge currently means silent involuntary churn.
- **Why it matters:** involuntary churn (expired/failed cards) is recoverable revenue we're simply dropping. A dunning sequence (retry schedule + honest "your payment didn't go through, here's how to fix it" email/notification, no fear, no shame) recovers a meaningful share of would-be-lost subscribers. Annual-default *reduces* the failure surface (§1.3) but doesn't eliminate it — annual renewals still fail, and any remaining monthly subs fail monthly.
- **Build when:** once paid subscribers exist and renewals start cycling. Pairs naturally with the subscription-management UI above.

**Note:** see the `churn-prevention` skill for the detailed cancel-flow / save-offer / dunning playbooks when these come up the queue. Anything built there inherits the same vetoes — no fear, no fake scarcity, no dark patterns.

---

## Quick reference — what's LIVE vs planned

| Item | Status |
|---|---|
| SiteSettings-driven pricing page | **LIVE** |
| Annual as default/recommended (`pricing.recommended`, A/B-tunable, no redeploy) | **LIVE** |
| Annual per-month equiv (≈₹417/mo) + computed savings % | **LIVE** |
| `UpgradePrompt` paywall on chat credit exhaustion | **LIVE** |
| Revenue-funnel events (`pricing_viewed`, `plan_selected`, `checkout_started`, `purchase`) | **LIVE** |
| Paywall events (`paywall_view` / `paywall_click` / `paywall_dismiss`) | **LIVE** |
| 402 feature gates (reports / palmistry) → `/checkout` | **LIVE** |
| Paywall on report gate / Decision Room / daily-briefing depth | Planned (reuse `UpgradePrompt`) |
| Premium+ tier (voice, priority, deeper Decision Room) | Held in reserve — not pre-PMF |
| NRI geo-pricing (USD/GBP/AED) | Planned — Q3 |
| A/B tests (annual-default, copy on/off, paywall timing) | Pending traffic + sample-size discipline |
| Subscription-management UI (cancel/pause) | Deferred |
| Dunning on `payment.failed` | Deferred |
