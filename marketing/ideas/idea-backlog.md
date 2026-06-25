# MyAstro360 — Marketing Idea Backlog

**Product:** MyAstro360 (repo: jyotryx) — Vedic astrology platform. Deterministic Swiss-Ephemeris / Lahiri engine + AI narrative. Zero marginal cost per chart, 13 languages.
**Positioning (anti-Astrotalk):** "the meter never runs" (flat unlimited vs per-minute) · "same math every time" · "shows its work" · "no fake astrologers / no fear-selling".
**Competitors:** Astrotalk (per-minute human marketplace) · Astrosage (free-but-cluttered calculators).
**ICP:** urban + NRI Indians, 22–38.
**Stage:** bootstrapped (<₹50k/mo), pre-launch / private beta, solo founder, Android launching in 1–3 months.
**Q1 priority:** ACQUISITION (front-loaded below).

_Last updated: 2026-06-25_

---

## 1. Prioritization method — ICE

Each idea is scored on three axes (1–10), and **ICE = average of the three**:

- **Impact** — how much this moves the Q1 acquisition needle if it works.
- **Confidence** — how sure we are it works for *this* product/stage (evidence, fit, low assumption risk).
- **Ease** — how cheap/fast it is for a solo founder under ₹50k/mo (10 = a weekend, 1 = months or money we don't have).

Every idea is also tagged with:

- **AARRR stage** — Acquisition / Activation / Retention / Referral / Revenue.
- **Skill** — the executing discipline: `programmatic-seo`, `ai-seo`, `seo-audit`, `social`, `community-marketing`, `emails`, `referrals`, `pricing`, `paywalls`, `aso`, `launch`, `public-relations`, `directory-submissions`, `competitors`, `free-tools`, `content-strategy`, `analytics`.

Sort: **ICE descending**, with acquisition-stage ideas front-loaded to honour the Q1 priority. Ties broken toward acquisition + lower founder bandwidth.

---

## 2. Already shipped / shipping (this session — for continuity)

These are done or in flight; do **not** re-scope them. Listed so the next pass builds on top.

| # | Item | AARRR | Skill | Status |
|---|------|-------|-------|--------|
| S1 | Funnel instrumentation — GA4 + PostHog events across the funnel | All | analytics | **Shipped** |
| S2 | Pricing: annual-default + value anchor on pricing page | Revenue | pricing | **Shipped** |
| S3 | In-product `UpgradePrompt` paywall | Revenue | paywalls | **Shipped** |
| S4 | `ShareButton` on horoscope pages | Referral | referrals | **Shipping** |
| S5 | Enriched `llms.txt` for AI crawlers | Acquisition | ai-seo | **Shipped** |
| S0a | ~500 programmatic SEO URLs (per-sign horoscope, per-city panchang/kundli, localized) | Acquisition | programmatic-seo | **Shipped (prior)** |
| S0b | robots AI-crawler allowlist, JSON-LD, hreflang, OG cards | Acquisition | ai-seo / schema | **Shipped (prior)** |
| S0c | Free tool pages (kundli, numerology, matching, panchang, muhurat, palmistry, tarot, vastu) | Acquisition | free-tools | **Shipped (prior)** |

---

## 3. Ranked backlog (ICE descending, acquisition-first)

| # | Idea | AARRR | Skill | Impact | Confidence | Ease | ICE | Notes |
|---|------|-------|-------|:------:|:----------:|:----:|:---:|-------|
| 1 | **Sign × sign compatibility — 144 programmatic pages** (e.g. "Aries woman & Leo man Vedic compatibility"). Reuse matching engine + AI narrative; localize across the 13 languages already wired. | Acquisition | programmatic-seo | 9 | 9 | 9 | **9.0** | Highest-volume evergreen astrology query class; zero marginal cost; templates + data already exist. Internal-link from each sign horoscope page. |
| 2 | **vs-Astrotalk & vs-Astrosage comparison pages** anchored on "the meter never runs" / "same math every time". Honest, no trash-talk. | Acquisition | competitors | 9 | 9 | 8 | **8.7** | Captures bottom-funnel "Astrotalk alternative / free" intent. Differentiation is already crisp — just needs the page. |
| 3 | **Enrich the 500 pSEO pages with "shows its work" panels** — show the actual planetary degrees / Lahiri ayanamsa used, then the AI reading. Add FAQ JSON-LD. | Acquisition | ai-seo | 8 | 9 | 9 | **8.7** | Turns the determinism moat into on-page proof + AI-citation fuel; differentiates from thin competitor pages. Mostly a template edit. |
| 4 | **Nakshatra / dasha / dosha explainer cluster** (27 nakshatras, Vimshottari dasha, Mangal/Kaal Sarp/Pitra dosha) — definitive long-form, interlinked hub. | Acquisition | programmatic-seo | 8 | 9 | 8 | **8.3** | High-intent informational class Astrosage ranks for but explains badly. Feeds tool pages and "shows its work" CTA. |
| 5 | **Free-tool lead capture: gate the saved/PDF chart** behind email (tool itself stays free, ungated). Wire to welcome email. | Acquisition | free-tools | 8 | 9 | 8 | **8.3** | Converts existing tool traffic into a list — the missing link between SEO traffic and Android launch. Low lift on top of shipped tools. |
| 6 | **Reddit/Quora answer engine** — genuinely helpful answers in r/Vedicastrology, r/AstrologyIndia, r/NRI, Quora astrology topics; link only when it actually answers. | Acquisition | community-marketing | 8 | 8 | 8 | **8.0** | Solo-founder-friendly, free, compounding. ICP lives here. No spam — "shows its work" voice fits the skeptical crowd. |
| 7 | **/learn blog hub** — pillar + cluster content strategy (how Vedic differs from Western, reading your kundli, ayanamsa explained). Hosts the explainers above. | Acquisition | content-strategy | 8 | 8 | 8 | **8.0** | Gives the pSEO clusters an editorial spine and a place for internal links + AI-citable depth. |
| 7b | **Numerology / mulank cluster** (mulank 1–9, bhagyank, name numerology, lucky number by DOB) tied to the numerology free tool. | Acquisition | programmatic-seo | 7 | 9 | 9 | **8.3** | High-volume, low-competition number queries; tool already exists, just needs the page cluster + internal links. |
| 8 | **AI-SEO: get cited in ChatGPT/Perplexity/Gemini answers** — structure key pages as Q&A, expand `llms.txt`, add "method & sources" sections. | Acquisition | ai-seo | 8 | 7 | 8 | **7.7** | Crawler allowlist + llms.txt already shipped — this is the content-shaping layer that earns the citation. |
| 9 | **Welcome + feature-discovery email sequence** (3–4 mails: your chart, free tools tour, what makes us different, app waitlist). | Activation | emails | 7 | 9 | 7 | **7.7** | Activates the list from #5; primes Android install. Mostly copy + automation. |
| 10 | **WhatsApp daily horoscope opt-in** — broadcast/list, deep-links back to web (and later app). Personal-by-sign. | Acquisition | community-marketing | 8 | 7 | 7 | **7.3** | WhatsApp is the ICP's native channel; cheap distribution + retention hook. Keep within WhatsApp policy (opt-in only). |
| 11 | **Share-a-reading viral loop** — extend shipped `ShareButton` into shareable reading cards (clean OG image per reading) with a soft "get yours free" CTA. | Referral | referrals | 8 | 7 | 7 | **7.3** | Builds on S4; turns every reading into an acquisition surface. Needs OG-image-per-reading generation. |
| 12 | **Product Hunt launch** timed with Android GA — "flat-fee Vedic astrology, the meter never runs." | Acquisition | launch | 8 | 7 | 6 | **7.0** | One-shot spike + backlinks + directory halo. Prep maker comments, assets, hunter. Sequence after beta polish. |
| 13 | **Play Store ASO** — keyword-optimized title/short/long description, screenshots that show "unlimited / no per-minute," localized store listing. | Acquisition | aso | 8 | 8 | 5 | **7.0** | Direct lever on install conversion at the 1–3 month launch. Do before GA, iterate after. |
| 14 | **Short-form video** (Reels/Shorts/YT) — "why two apps give you different kundlis and we don't," nakshatra explainers, myth-busting. Founder voice. | Acquisition | social | 8 | 6 | 7 | **7.0** | Highest-reach organic channel for this ICP; "shows its work" is inherently visual. Bandwidth risk → batch-record. |
| 15 | **Directory submissions** — Indian startup + AI-tool + astrology directories for backlinks/DR and discovery. | Acquisition | directory-submissions | 6 | 9 | 8 | **7.7** | Cheap, durable backlinks that lift the whole pSEO domain. Batchable in an afternoon. |
| 16 | **"Same math every time" reproducibility demo page** — run any birth detail, show identical output + the exact ephemeris/ayanamsa, contrast with screenshot of competitor variance. | Acquisition | free-tools | 7 | 8 | 7 | **7.3** | Turns the core moat into a shareable, PR-able artifact. Interactive proof beats claims. |
| 17 | **Synastry consent-share** — invite a partner/friend to combine charts; both must opt in. Two-sided invite = built-in acquisition. | Referral | referrals | 8 | 6 | 6 | **6.7** | Compatibility is the most-shared use case; consent-gated invite spreads to new users natively. Needs invite flow. |
| 18 | **Anti-Astrotalk / no-fear-selling PR story** — pitch the "ethics in astrology tech: flat-fee, no fake astrologers, no fear-selling" angle to Indian tech/startup press + newsletters. | Acquisition | public-relations | 7 | 6 | 6 | **6.3** | Differentiated, genuinely newsworthy founder narrative. Earned coverage + backlinks; no budget needed beyond outreach time. |
| 19 | **City panchang/kundli pSEO expansion** to next tier of Indian cities + top NRI metros (Toronto, London, Dubai, SF Bay, Singapore, Sydney). | Acquisition | programmatic-seo | 7 | 8 | 7 | **7.3** | Extends the proven city-page pattern into the NRI segment; hreflang already in place. |
| 20 | **NRI-targeted landing + content** — timezone-correct charts abroad, "Vedic astrology for the diaspora," festival/muhurat in local time. | Acquisition | content-strategy | 7 | 7 | 6 | **6.7** | NRIs have higher willingness-to-pay and weaker local options; the multi-language + timezone engine is a real edge. |
| 21 | **Win-back / re-engagement email** for dormant beta + list (new feature, "your dasha changed," app-is-live). | Retention | emails | 6 | 8 | 7 | **7.0** | Cheap reactivation; astrology has natural time-based re-engagement triggers (transits, new year, birthday). |
| 22 | **Muhurat / festival "what to do today" social calendar** — pre-scheduled posts around Indian festivals & auspicious dates, each linking the muhurat tool. | Acquisition | social | 7 | 7 | 7 | **7.0** | Predictable, batchable, highly shareable in the ICP; festival dates are known a year out. |
| 23 | **Birthday/transit-triggered email + WhatsApp** — "your solar return chart is ready" on the user's birthday. | Retention | emails | 6 | 8 | 6 | **6.7** | Personalized, automatable, high open-rate moment. Deterministic engine makes this trivial to generate. |
| 24 | **Quora Spaces / topic ownership** — build a "Vedic astrology, explained honestly" space; repurpose /learn content. | Acquisition | community-marketing | 6 | 7 | 7 | **6.7** | Compounds with #6 and #7; evergreen referral traffic. Low cost, founder-voice fits. |
| 25 | **Tarot / palmistry / vastu tool-page SEO + lead capture** parity with kundli (each tool gets its own keyword cluster + share + email gate on save). | Acquisition | free-tools | 6 | 8 | 7 | **7.0** | Spreads the #5 pattern across all shipped tools; multiplies capture surfaces with little new code. |
| 26 | **"Powered by MyAstro360" embeddable mini-widget** (free horoscope/panchang widget for bloggers/regional sites) with backlink. | Acquisition | free-tools | 6 | 6 | 6 | **6.0** | Distribution + backlinks via other people's sites; classic engineering-as-marketing. Build after core funnel. |
| 27 | **Newsletter / micro-influencer swaps** with NRI and astrology creators (no paid spend — content trade / cross-promo). | Acquisition | social | 6 | 6 | 6 | **6.0** | Borrowed audiences without ad budget; fits bootstrapped constraint. Slow to line up. |
| 28 | **In-app referral ("gift a free reading")** at the post-reading moment — give a friend a full reading, both get a perk. | Referral | referrals | 7 | 6 | 5 | **6.0** | Stronger loop than share button but needs app + incentive logic; sequence after Android GA. |
| 29 | **Dosha-checker free tool** (Mangal/Manglik, Kaal Sarp, Pitra) as a standalone lead magnet — high-anxiety-but-we-answer-honestly, *no* fear-selling. | Acquisition | free-tools | 7 | 7 | 5 | **6.3** | Huge search demand; our angle = calm, factual, "here's what it actually means" vs competitors' fear-selling. New tool build = lower ease. |
| 30 | **SEO technical audit + internal-linking pass** across the 500 pages + new clusters (orphan pages, sitemap, Core Web Vitals, canonical). | Acquisition | seo-audit | 6 | 8 | 6 | **6.7** | Makes everything else rank better; one focused audit lifts the whole programmatic estate. |
| 31 | **"State of Vedic Astrology" data/annual report** — anonymized, aggregated trends (most-searched signs, dosha frequency) once beta has volume. | Acquisition | content-strategy | 6 | 5 | 4 | **5.0** | Link-bait + PR asset, but needs real usage volume first — revisit post-launch. No invented numbers until data exists. |
| 32 | **Lifetime/founding-member early-access offer** for beta users (honest, no countdown) to seed revenue + testimonials-by-consent later. | Revenue | pricing | 6 | 6 | 6 | **6.0** | Early cash + committed cohort without false scarcity. Frame as genuine founding-member, time-boxed honestly. |
| 33 | **Activation paywall tuning** — A/B the shipped `UpgradePrompt` placement/copy against the "meter never runs" frame using PostHog. | Revenue | paywalls | 6 | 7 | 6 | **6.3** | Builds on S1/S3; squeezes more from existing traffic. Needs enough volume for signal (post-launch). |
| 34 | **Regional-language social handles** (Hindi/Tamil/Telugu/Bengali short-form) leveraging the 13-language engine. | Acquisition | social | 6 | 6 | 5 | **5.7** | Under-served vernacular astrology audience; the localization moat is already built. Bandwidth-heavy → after English motion proven. |

---

## 4. Explicit SKIPS (brand-voice violations — do not do)

These conflict with the VETO'd brand voice. Listed so they're never accidentally picked up.

| Tactic | Why skipped |
|--------|-------------|
| Fear-driven urgency ("dosha will ruin your marriage — fix it now") | **Fear-selling.** Core anti-positioning; we sell calm clarity, not dread. Dosha content stays factual/reassuring (#29). |
| Fabricated testimonials / made-up reviews / star-rating padding | **Fake social proof.** Destroys the "honest astrology" trust moat. Use only real, consented user words. |
| Fake-astrologer personas ("Pandit-ji is online now") | **Directly the thing we're against** vs Astrotalk's human-marketplace theatre. We're deterministic math + AI, and we say so. |
| Countdown timers / false scarcity / "only 3 slots left" | **Manufactured scarcity.** Even on pricing/founding-member offers, scarcity must be genuine and honestly framed (#32). |
| "Your stars predict doom unless…" ad hooks | Fear-selling in paid form — and paid is deferred anyway. |

## 4b. DEFERRED until funded (revisit post-raise / post-revenue)

Good ideas, wrong stage for a <₹50k/mo solo founder pre-launch.

| Tactic | Defer because |
|--------|---------------|
| Paid ads (Google / Meta / app-install campaigns) | No budget; Q1 is organic acquisition. Revisit once CAC↔LTV is measurable post-launch. |
| Conferences / offline events / meetups | Time + travel cost; near-zero ROI at pre-launch scale. |
| FTE / agency hiring (content, growth, support) | Solo by design until revenue justifies headcount. |
| Building a human-astrologer marketplace | Contradicts the deterministic-engine positioning *and* needs ops/supply we don't have. Likely a permanent strategic "no." |
| Large-scale influencer sponsorships (paid) | Paid spend; do unpaid swaps (#27) instead for now. |

---

## 5. Pull the next 5 — start these now

Chosen for: acquisition-first, highest ICE, and realistic for one founder with a launch 1–3 months out. Each reuses an asset that already exists.

1. **#1 — Sign × sign compatibility (144 pages).** Highest ICE (9.0), pure acquisition, and the matching engine + multi-language templates already exist — this is the single biggest organic-traffic unlock before launch, at zero marginal cost.
2. **#2 — vs-Astrotalk & vs-Astrosage comparison pages.** Captures bottom-funnel "alternative / free" buyers actively shopping competitors; our differentiation ("meter never runs," "same math") is already sharp, so it's mostly writing the page honestly.
3. **#3 — "Shows its work" panels on the 500 existing pages.** A template edit that turns the determinism moat into on-page proof + AI-citation fuel, instantly upgrading 500 already-indexed URLs instead of starting new ones.
4. **#5 — Email gate on saved/PDF charts (+ #9 welcome sequence).** Builds the list that bridges today's SEO traffic to the Android launch; without capture, all the traffic above leaks. Low lift on top of shipped tools, and it primes installs.
5. **#15 — Directory submissions.** An afternoon of work for durable backlinks/DR that lift the entire programmatic estate (helping #1–#4 rank), and it warms up the directory ecosystem ahead of the Product Hunt + Play Store launch.

_Sequencing note: #1–#3 are content/SEO the founder can batch; #5 is a small build + automation; #15 is a one-sitting task. Hold #12 (Product Hunt) and #13 (ASO) for the launch window, but start drafting their assets in parallel._
