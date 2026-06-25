# MyAstro360 — Answer-Engine Optimization (AEO) Playbook

> Goal: get MyAstro360 **cited** by AI answer engines (ChatGPT, Perplexity, Gemini, Google AI Overviews, Claude) for high-intent Indian-astrology questions, and convert that citation traffic into signups. AEO is the Q1 acquisition lever that compounds with the ~500 programmatic URLs already shipped.
>
> Framework applied: the `ai-seo` skill (llms.txt / Open Knowledge Format, citation optimization, entity consolidation). This playbook references only routes/files that exist in the repo today.
>
> Last reviewed: 2026-06-25 · Owner: founder (solo) · Cadence: monitoring is monthly (Section 6).

---

## 1. Why AEO fits this product

The transparency/determinism thesis is the most citation-friendly positioning in the entire Indian astrology category. AI answer engines reward sources they can trust, attribute, and quote — and MyAstro360's two differentiators map directly onto what makes content citable:

- **"Same math, every time" (determinism).** Charts are computed with the Swiss Ephemeris using the Lahiri (Chitrapaksha) ayanamsa — the same inputs always produce the same chart. This is a *methodology statement*, the single highest-value signal for AI citation (the Princeton GEO study found "cite sources" / "add statistics" / "authoritative tone" are the top boosts, +25–40%). Most astrology competitors are mystical and unfalsifiable; we can state a reproducible method and name an authoritative source (Swiss Ephemeris, the Indian-government-standard Lahiri ayanamsa). An LLM can cite that without hedging.
- **"Shows its work" (traceability).** Every reading can reveal the underlying chart factors ("Saturn in the 7th house + an active Venus dasha"). That is exactly the extractable, self-contained, factor-by-factor structure AI systems prefer to quote — it reads like a referenceable explanation, not a horoscope blurb.
- **Anti-Astrotalk by construction.** The category leader sells per-minute consultations and fear-based remedies. Neither produces stable, quotable, open web content. Our public explainer + FAQ pages (deterministic, dated, sourced) are structurally the kind of page an answer engine cites *instead of* a paywalled consultation funnel.
- **No fear-selling, no fabricated proof.** This is also an AEO asset: fabricated stats and invented "celebrity astrologer" claims are the fastest way to lose citation trust. Our brand voice (interpretation, not fact; remedies optional) keeps us citable long-term.
- **Foundation already in place.** AI-crawler allowlist in `robots.ts` (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.), JSON-LD (Organization/WebSite/Article/BreadcrumbList/FAQPage), hreflang across 13 locales, an enriched `public/llms.txt`, and ~500 programmatic URLs. AEO here is *layering structure + a definitional cluster on top of an existing technical base*, not starting from zero.

**The thesis in one line for every page:** answer the question crisply, then show the chart factors and name the method (Swiss Ephemeris / Lahiri). That sentence is what gets quoted.

---

## 2. Target answer-engine queries (prioritized)

High-intent Indian-astrology questions, ranked by intent + how winnable they are with our determinism/traceability angle. Each maps to the page that should win the citation. "NEW /learn" = build per Section 3; everything else exists today.

### Tier 1 — definitional head terms (highest volume, build the /learn page)

| # | Query | Winning page | Why we can win the citation |
|---|-------|--------------|------------------------------|
| 1 | "how does kundli matching work" / "what is guna milan / ashtakoota" | NEW `/learn/kundli-matching` → links to `/matching` | We can lay out the 36-guna / 8-koota system as a HowTo + table, sourced to a deterministic engine |
| 2 | "what is sade sati" (Saturn 7.5-year transit) | NEW `/learn/sade-sati` → `/kundli` | Define the three phases by Saturn's transit over the moon sign; cite Lahiri sidereal calc |
| 3 | "what is mangal dosha / manglik" | NEW `/learn/mangal-dosha` → `/matching` | Define Mars placements (1/2/4/7/8/12 houses), name cancellation rules; traceable, not fear-framed |
| 4 | "what is rahu kaal" / "how to read a panchang" | NEW `/learn/rahu-kaal` + NEW `/learn/panchang` → `/panchang` and `/panchang/[city]` | We compute Rahu Kaal per city lat/long from sunrise/sunset — strongest determinism story |
| 5 | "what is my mulank / numerology number" / "what is bhagyank" | NEW `/learn/mulank` → `/numerology` | Define mulank vs bhagyank, Chaldean vs Pythagorean; HowTo for the reduction |
| 6 | "what is a kundli / janam kundli / birth chart" | NEW `/learn/kundli` → `/kundli` | Define the chart, name Swiss Ephemeris + Lahiri ayanamsa — the methodology page |
| 7 | "what is nakshatra" / "what is my nakshatra" | NEW `/learn/nakshatra` → `/kundli`, `/panchang` | 27 lunar mansions, computed from moon's sidereal longitude |
| 8 | "what is dasha / vimshottari dasha" | NEW `/learn/vimshottari-dasha` → `/kundli` | 120-year planetary period system; HowTo + table; deterministic from moon nakshatra |

### Tier 2 — comparison & compatibility (high intent, partly served)

| # | Query | Winning page | Notes |
|---|-------|--------------|-------|
| 9 | "[sign] and [sign] compatibility" (e.g. "leo and scorpio compatibility") | `/matching` + NEW `/learn/zodiac-compatibility` hub | Comparison content is the single most-cited format (~33% of AI citations). Hub page + link to the matching tool |
| 10 | "rashi vs sun sign" / "western vs vedic astrology" | NEW `/learn/vedic-vs-western-astrology` | Comparison table = high citation rate; our sidereal-vs-tropical explanation is already in the horoscope FAQ |
| 11 | "what is my rashi / moon sign" | NEW `/learn/rashi` → `/kundli` | Moon sign (rashi) matters more than sun sign in Vedic — quotable distinction |
| 12 | "ascendant / lagna meaning" | NEW `/learn/lagna` → `/kundli` | Define the rising sign, computed from birth time + place |

### Tier 3 — per-entity long-tail (already covered by programmatic URLs — protect & enrich)

| # | Query pattern | Winning page (exists) | Action |
|---|---------------|------------------------|--------|
| 13 | "[sign] horoscope today / weekly / monthly" | `/horoscope/[sign]/[period]` | Keep daily freshness; localize FAQ (Section 4) |
| 14 | "panchang [city] today" / "rahu kaal [city]" | `/panchang/[city]` (×50) | City-specific determinism is our moat — link each up to `/learn/rahu-kaal` and `/learn/panchang` |
| 15 | "kundli [city]" / "free kundli online" | `/kundli/[city]` (×50), `/kundli` | Link up to `/learn/kundli` |
| 16 | "free tarot / palmistry / vastu / muhurat" | `/tarot`, `/palmistry`, `/vastu`, `/muhurat` | FeatureSeoSection explainer + FAQ already live; ensure each links to its /learn term where relevant |

**Query fan-out note:** answer engines retrieve concurrent related queries, not just the typed one. The /learn cluster + existing tool pages should *cross-link densely* (each /learn page links to its tool and to 2–3 sibling /learn terms) so the whole topical cluster is retrievable for the fan-out variants, not just the exact-match page.

---

## 3. The `/learn` definitional cluster — BUILD SPEC

The gap: tool pages (`/kundli`, `/matching`, …) target *transactional* intent ("generate my chart"). The Tier-1/Tier-2 queries above are *definitional* ("what is sade sati"). Answer engines cite definitional pages; we don't have dedicated ones. The `/learn/[slug]` cluster fills exactly that gap and feeds the existing tools.

### Routes to create

- `apps/web/src/app/learn/[slug]/page.tsx` — English (root, no prefix), statically generated via `generateStaticParams` over the slug registry.
- `apps/web/src/app/[locale]/learn/[slug]/page.tsx` — localized variants under the existing `[locale]` segment (mirror the pattern used by the localized horoscope/panchang routes). Publish first in `LANDING_LOCALES` (`en, hi, bn, kn, ta, te, ml`) since those locale dictionaries are already complete and pre-render infra exists; the rest can follow as ISR.

### Page anatomy (each `/learn/[slug]`)

1. **Question-led H1 = the query verbatim** ("What is Sade Sati?"). One direct 40–60-word answer in the first paragraph (snippet-optimal; leads the section, never buried).
2. **"How it works" ordered list** — the calculation, sourced to **Swiss Ephemeris / Lahiri ayanamsa** so the determinism thesis is on-page. Reuse the **`FeatureSeoSection`** component (`components/seo/FeatureSeoSection.tsx`) — it already renders `heading` + `intro[]` + `howItWorks{heading,steps[]}` + `faqs[]` and emits **FAQPage** JSON-LD. Drive it from a `FeatureContent`-shaped object (`lib/seo/feature-content.ts`) so we get the same structure for free.
3. **Three JSON-LD blocks** per page:
   - **`DefinedTerm`** — the concept name + concise definition (entity consolidation: makes the term a recognizable entity the engines can attach to the brand). New schema for this repo.
   - **`FAQPage`** — emitted by `FeatureSeoSection` from `content.faqs` (existing pattern).
   - **`HowTo`** — for the calculation steps (e.g. "How Guna Milan is scored"). New schema; add a `HowTo` emitter alongside the existing FAQ emitter.
4. **Metadata** via `pageMetadata(...)` (English) / `localizedMetadata(...)` (locale) from `lib/seo/page-metadata.ts` — self-canonical + hreflang are handled there; pass `hreflang: true` and the published-locale subset so we never emit an hreflang to a 404.
5. **Cross-links:** each page links down to its tool (`/kundli`, `/matching`, `/panchang`, `/numerology`) and across to 2–3 sibling `/learn` terms (feeds query fan-out + entity consolidation).
6. **Register in `app/sitemap.ts`:** add a `learnPages` array (one entry per slug, `changeFrequency: 'monthly'`, `priority: 0.7`) plus localized variants over `PREFIXED_LANDING_LOCALES` via `localeUrl(locale, '/learn/<slug>')` — mirror how `localizedHoroscopePages` is built. Append to the returned array.

### First 8–10 slugs

| Slug | Target query | One-line angle |
|------|--------------|----------------|
| `kundli` | "what is a kundli / janam kundli / birth chart" | The methodology page: defines the Vedic birth chart and names Swiss Ephemeris + Lahiri ayanamsa — our determinism anchor. |
| `kundli-matching` | "how does kundli matching work / guna milan" | Explains the 36-guna / 8-koota Ashtakoota system as a HowTo, links to `/matching`. |
| `sade-sati` | "what is sade sati" | Defines Saturn's 7.5-year transit over the moon sign in three phases — calm, factual, no fear-framing. |
| `mangal-dosha` | "what is mangal dosha / manglik" | Defines Mars placements that cause it and the cancellation rules; traceable, remedies framed as optional. |
| `rahu-kaal` | "what is rahu kaal" | Defines the inauspicious daily window, computed per city from sunrise/sunset — strongest "same math, every time" story. |
| `panchang` | "how to read a panchang" | Defines tithi/nakshatra/yoga/karana, links to `/panchang/[city]`; city-specific determinism. |
| `mulank` | "what is my mulank / numerology number" | Defines mulank vs bhagyank, Chaldean vs Pythagorean reduction; HowTo for the math, links to `/numerology`. |
| `nakshatra` | "what is nakshatra / what is my nakshatra" | Defines the 27 lunar mansions, computed from the moon's sidereal longitude. |
| `vimshottari-dasha` | "what is dasha / vimshottari dasha" | Defines the 120-year planetary-period system as a HowTo + table, deterministic from moon nakshatra. |
| `vedic-vs-western-astrology` | "vedic vs western astrology / rashi vs sun sign" | Comparison-table page (highest-cited format) explaining sidereal vs tropical — reuses the sun-sign/Vedic distinction already in the horoscope FAQ. |

Ship the first three (`kundli`, `kundli-matching`, `rahu-kaal`) as the pilot — they carry the methodology anchor and the two clearest determinism stories — then fill the rest.

---

## 4. FAQ localization

The horoscope and panchang landing-page FAQs are currently **hardcoded English** inside the route files (`app/horoscope/[sign]/page.tsx` builds a `const faqs` array around line 108; `app/panchang/[city]/page.tsx` builds one around line 135). On a `/hi/horoscope/...` or `/ta/panchang/...` page, that English FAQ leaks into an otherwise-localized page — a mixed-language signal that both hurts UX and weakens the citation case in non-English answer engines (Hindi/Tamil/etc. AI queries).

**Fix:**

1. Move the FAQ strings into the locale dictionaries (`i18n/en.ts` + all 12 others), under a new namespace such as `horoscopeLanding.faqs` and `panchangLanding.faqs`. The question templates interpolate runtime values (`${sign.name}`, `${sign.dateRange}`, `${city.name}`), so store them as templates with named placeholders and substitute at render time (don't bake the entity into the dictionary string).
2. In each route, replace the inline `const faqs` with a lookup against the resolved-locale dictionary, then build the FAQPage JSON-LD from the *localized* array (the existing "single source of truth" pattern still holds — visible FAQ and schema both read from the same localized array, so they never drift).
3. **Respect i18n parity.** `apps/web/src/__tests__/i18n-parity.test.ts` enforces that every new `en.ts` key is mirrored in all 13 locale files (exact nested-key shape, no empty/whitespace, no untranslated copy-paste). So: add the keys to `en.ts`, then add the translated equivalents to all 12 others *in the same change*, or the suite fails the build. Add genuinely translated FAQ copy per locale — do not paste English (the test's untranslated-value check will flag it).

This also unlocks publishing the horoscope/panchang FAQs in the full `LANDING_LOCALES` set with real localized answer text, strengthening AEO for vernacular queries.

---

## 5. `llms.txt` upkeep + whether to add `llms-full.txt`

`public/llms.txt` is in good shape: it already carries the differentiators block ("What makes myastro360 distinctive"), concept-to-page citation guidance, and the methodology section (Swiss Ephemeris / Lahiri). Keep it as the canonical entity + concept-citation map.

**Upkeep (treat as a release checklist item):**

- When the `/learn` cluster ships, add a **"Concepts & guides"** entry for each new `/learn/[slug]` so engines route definitional queries to the dedicated page (e.g. `"What is sade sati?" → /learn/sade-sati`). This is the single most valuable update.
- Keep the languages list and feature list in sync with what's actually published (it currently lists 12 languages and the live tools — accurate today).
- Keep the methodology claims exactly matching the engine (Lahiri/Chitrapaksha, per-city lat/long) — never let llms.txt overstate. Fabricated capability is a trust-killer for citation.
- Re-verify the AI-crawler allowlist in `robots.ts` still admits GPTBot, ClaudeBot, PerplexityBot, Google-Extended, ChatGPT-User, Bingbot each time robots changes.

**`llms-full.txt`: not yet — defer.** `llms-full.txt` is meant to be a single concatenated full-text dump of the corpus. Our authoritative long-form content (feature explainers + FAQs) is already crawlable HTML behind the AI-crawler allowlist with FAQ/Article schema, so a full dump adds little today and creates a second surface to keep in sync (drift risk for a solo founder). Revisit **after** the `/learn` cluster exists: at that point an `llms-full.txt` that concatenates the ~10 definitional answers (the crisp 40–60-word definitions + HowTo steps + sources) becomes genuinely useful as a compact, quotable knowledge bundle. Trigger to add it: /learn cluster live in English **and** we see AI referral traffic worth optimizing (Section 6).

**Open Knowledge Format (`/okf/`):** skip for now. OKF (Google-backed, v0.1) has no confirmed AI-search ranking signal yet — it's protocol-layer registration. With a solo founder and limited Q1 hours, the enriched `llms.txt` + the /learn cluster + schema cover the same ground at far lower maintenance cost. Note it on the backlog; revisit if a major engine announces it consumes OKF.

---

## 6. Monitoring

Solo-founder-friendly: one manual prompt-test pass per month + GA4 referral tracking. No paid tools required to start.

### 6a. Monthly prompt-test checklist

On the 1st of each month, run **each Tier-1 + Tier-2 target query** (Section 2) through **ChatGPT (search on), Perplexity, Gemini, and Claude (search on)**. For each query record: (1) is myastro360 cited? (2) which exact URL is cited? (3) if not us, who is (competitor)? (4) is the *methodology/determinism* point reflected in the answer? Log in a spreadsheet, one row per query × engine, tracked month-over-month.

| Query (from Section 2) | ChatGPT | Perplexity | Gemini | Claude | Our URL cited | Competitor cited | Determinism reflected? |
|---|---|---|---|---|---|---|---|
| how does kundli matching work | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is sade sati | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is mangal dosha | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is rahu kaal | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| how to read a panchang | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is my mulank / numerology | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is a kundli / janam kundli | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is nakshatra | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is vimshottari dasha | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| [sign] and [sign] compatibility (rotate pair) | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| vedic vs western astrology | ☐ | ☐ | ☐ | ☐ | | | ☐ |
| what is my rashi / moon sign | ☐ | ☐ | ☐ | ☐ | | | ☐ |

**Acting on results:** if a competitor is cited and we're not, compare extractability — do they have a crisper first-paragraph definition, a comparison table, dated/sourced stats? Feed gaps back into the relevant `/learn` page. Track "share of citations" (our cited cells ÷ total cells) as the headline AEO metric month-over-month.

### 6b. GA4 — AI-referral traffic

AI answers drive *referral* sessions when a user clicks the citation. Track them so AEO has a revenue line, not just a citation count.

- **Build an "AI referrers" segment / exploration** filtered to session source / referrer containing: `chatgpt.com`, `perplexity.ai`, `gemini.google.com` (add `copilot.microsoft.com`, `claude.ai`, `bing.com` as they appear). Some arrive as direct (no referrer) — the manual prompt-test pass is the cross-check for those.
- **Report monthly:** AI-referral sessions, top landing pages (expect `/learn/*` and per-city/per-sign pages to lead), and signup conversions from that segment. This is the number that justifies continued AEO investment for Q1 acquisition.
- Optionally tag AI-referral landing-page links with a UTM-free custom dimension if/when worth the effort; for now the referrer filter is sufficient.

---

## 7. Schema expansion opportunities

Current coverage: Organization, WebSite, Article, BreadcrumbList, FAQPage. Add three types, all of which directly raise extractability for the target queries:

- **`DefinedTerm` (new) — highest leverage.** One per `/learn/[slug]` (and optionally per key concept on tool pages: "Guna Milan", "Rahu Kaal", "Mulank"). Turns each astrology concept into a recognizable entity tied to the brand (entity consolidation), which is exactly what answer engines attach citations to for "what is X" queries. Optionally group them under a `DefinedTermSet` ("MyAstro360 Vedic astrology glossary") for a consolidated entity.
- **`HowTo` (new).** For every calculation/process: Guna Milan scoring, reading a panchang, computing a mulank, generating a kundli. Enables step extraction for the large "how does X work / how to X" query class. Add a `HowTo` emitter next to the existing FAQ emitter in `FeatureSeoSection` (or a sibling component) so it's driven from the same `content.howItWorks.steps` already present in `feature-content.ts` — near-zero extra content cost.
- **`Service` (new).** On the tool pages (`/kundli`, `/matching`, `/numerology`, `/panchang`, `/muhurat`, etc.), describing each as an offered service (provider = the Organization entity, areaServed = India + diaspora, with pricing where applicable). Helps agentic/commerce engines understand what's actually offered and consolidates the tools under the brand entity.

**Sequencing:** ship `DefinedTerm` + `HowTo` with the `/learn` cluster (they're the reason the cluster gets cited); add `Service` to existing tool pages as a fast follow. Use the `schema` skill for exact implementation. Keep the existing "single source of truth" discipline: every schema field must mirror visible on-page content (no schema-only claims), matching how the current FAQPage JSON-LD is built from the same `faqs` array the page renders.

---

## Priority order for Q1 (acquisition focus)

1. **Ship `/learn` pilot** — `kundli`, `kundli-matching`, `rahu-kaal` (Section 3) with `DefinedTerm` + `FAQPage` + `HowTo`. These carry the determinism anchor and win Tier-1 queries.
2. **Add the new `/learn` URLs to `llms.txt`** (Section 5) and `sitemap.ts`.
3. **Localize horoscope/panchang FAQs** into locale dictionaries (Section 4) — unblocks vernacular AEO and clears the mixed-language signal.
4. **Run the first monthly prompt-test pass + stand up the GA4 AI-referrer segment** (Section 6) to baseline before/after.
5. **Fill the rest of the /learn cluster + add `Service` schema** to tool pages.
6. **Reassess `llms-full.txt`** once /learn is live and AI referral traffic is measurable.
