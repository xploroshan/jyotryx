# MyAstro360 — Social & Share-Loop Playbook

**Owner:** Solo founder (on camera) · **Stage:** Pre-launch / private beta · **Q1 priority:** Acquisition
**Positioning:** The anti-Astrotalk. *The meter never runs. We show our work. Same math every time. No fake astrologers, no fear-selling.*
**ICP:** Urban + NRI Indians, 22–38, English/Hindi-first.

### Brand voice — hard rules (these are VETOs, not preferences)
Every piece of content below already obeys these. If a draft breaks one, kill it.
- **No fear-selling / no doom.** Never "your Saturn will destroy your marriage." We explain, we don't threaten.
- **No fabricated testimonials, no fake-astrologer personas.** The founder is the only face. No invented "Pandit Sharma."
- **Shows its work.** Every claim traces to a chart factor (house, planet, dasha, guna). If we can't point to the why, we don't say it.
- **Warm, honest, judgment-free.** Talk to a smart friend, not a worried supplicant.
- **"Interpretation, not fact."** Astrology is a lens. We say so, on camera, often. It's a feature, not a disclaimer.

> Reference surfaces (all already live or specified — do not invent new ones): `ShareButton` (`apps/web/src/components/share/ShareButton.tsx`), `/og` brand card, `/match/[token]` + `/match/[token]/og` (the `SharedMatch` pattern), `SharedMatch` Prisma model, ~500 programmatic SEO URLs, analytics `track()` (`apps/web/src/lib/analytics.ts`) firing to GA4 + PostHog.

---

## 1. The share loop (PLG)

The cheapest distribution we have is a happy user forwarding a result on WhatsApp. The loop is: **user gets a reading → shares it → recipient sees a rich, screenshot-worthy preview → recipient clicks → recipient gets their own reading → shares.** `ShareButton` already fires `share_clicked {trigger, method}` and is wired on the public `/horoscope/[sign]` landing pages. That is step one. Here is the concrete follow-on build.

### 1a. Wire `ShareButton` into the three highest-intent reading surfaces

`ShareButton` is prop-driven (it adds no new i18n keys — callers pass already-localized labels). Drop it at the bottom of each reading with a distinct `trigger` so shares are attributable per surface:

| Surface | `trigger` value | Share `url` | Share `text` (localized, no fear-selling) |
|---|---|---|---|
| Localized horoscope (`/horoscope/[sign]` in non-English locales) | `horoscope` | the localized landing URL | "Here's what my sign actually means today — with the why, not the fear:" |
| Daily briefing (`my-day`) | `daily_briefing` | tokenized `/reading/[token]` (see 1b) | "My day, read from my actual chart. No meter, no doom:" |
| Kundli reading | `kundli` | tokenized `/reading/[token]` (see 1b) | "My full birth chart, explained — every line traces back to a planet:" |

Reuse the existing `matchShare.*`-style localized label strings for `shareLabel` / `copyLabel` / `copiedLabel`. The horoscope `trigger` already exists on the public pages; the daily-briefing and kundli triggers are new and must be distinct values so the calendar in §7 can read them.

### 1b. Tokenized per-reading OG snapshot — mirror the `SharedMatch` pattern exactly

`my-day` and `kundli` are private, logged-in surfaces — we can't share the live authed URL. So mirror what already exists for matches: a token-addressed, public-but-noindex snapshot with a rich per-share OG card. **Do not design a new pattern; copy the match one line-for-line.**

**New Prisma model — `SharedReading`** (parallels `SharedMatch` in `apps/api/prisma/schema.prisma`). Store only the *rendered, non-sensitive* fields needed to redisplay and to draw the card. **No birth details, no exact time/place** — same privacy bar as `SharedMatch`, which holds no birth data.

```prisma
model SharedReading {
  id           String   @id @default(uuid()) @db.Uuid
  token        String   @unique /// URL-safe public share token
  createdById  String?  @db.Uuid
  kind         String   /// "daily_briefing" | "kundli" — free-form, no migration to add more
  title        String   /// e.g. "Your day ahead" / "Sun in Libra, 7th house"
  summary      String   /// one-paragraph, already-interpreted, judgment-free text
  highlights   Json     /// [{ factor, value, note }] — the "shows its work" chart factors
  sign         String?  /// optional headline sign/placement for the card
  locale       String?  @db.VarChar(10)
  viewCount    Int      @default(0)
  createdAt    DateTime @default(now())

  createdBy User? @relation(fields: [createdById], references: [id], onDelete: Cascade)

  @@index([createdById])
  @@map("shared_readings")
}
```
(Add `sharedReadings SharedReading[]` to the `User` model alongside the existing `sharedMatches`.)

**New routes** (mirror `match/[token]`):
- **`/reading/[token]/page.tsx`** — copy `match/[token]/page.tsx`. Wrap the snapshot fetch in React `cache()` so `generateMetadata` + render share one upstream call (one view bump per visit). `robots: { index: false, follow: false }` (**noindex** — these are private share artifacts, not SEO surfaces; that's what the ~500 programmatic URLs are for). `canonical` to `/reading/[token]`, `openGraph.images` + `twitter` card pointing at `/reading/[token]/og`. Render a `SharedReadingView` that shows the summary **and the `highlights` chart factors** so the "shows its work" promise survives the forward.
- **`/reading/[token]/og/route.tsx`** — copy `match/[token]/og/route.tsx` verbatim, including the `NOTO_INDIC` script-loading and `buildFonts()` Latin+Indic logic (names/placements render in 11 scripts — without this they'd be "tofu" boxes). Keep `runtime = "nodejs"`, 1200×630, the dark-gold brand gradient, and the `myastro360` wordmark. The card's hero = the headline placement or summary line + one "the why" chart factor. Fall back to the generic brand card on unknown token.
- **`/reading/[token]/not-found.tsx`** — copy the match equivalent.

**Server API:** add `fetchSharedReading(token)` next to `fetchSharedMatch` in `lib/seo/server-api.ts` (no-store, bumps `viewCount`). The `my-day` / `kundli` "Share" action mints a `SharedReading` row, then points `ShareButton.url` at `/reading/[token]`.

**Why this closes the loop:** the recipient on WhatsApp sees a branded card with a real placement and a real reason ("Sun in Libra · why today feels social"), not a bare link. That's forward-worthy (see §5). Clicking lands them on a noindex snapshot that ends in a CTA to generate *their own* chart → they sign up → they share. Loop closed, every hop measured by `share_clicked` (see §7).

---

## 2. Short-form video plan

**The differentiated angle, in one line:** *"Here's what your chart actually says — no fear, here's the why."* Every video shows its work on camera. The founder reads a real factor (house/planet/dasha), explains the mechanism, and explicitly frames it as interpretation. This is the on-camera version of the product promise, and it's the thing Astrotalk-style content structurally can't copy without abandoning fear-selling.

**Volume:** 2–3 videos/week. 9:16, 20–45s, captions burned in (most viewing is muted), one idea per video, hook in the first second.

**Content pillars:**

1. **Myth-bust a fear-selling reading (flagship).** Take a common doom claim ("Mangal Dosha will ruin your marriage") → show what the chart factor *actually* indicates → reframe warmly with the why. Format: *"You've been told X. Here's what your chart actually says."* This pillar carries the positioning.
2. **"The meter never runs" explainers.** How pay-per-minute astrology is engineered to keep you on the call; how a deterministic engine gives the same answer every time. Build-trust content, not a teardown of named competitors.
3. **NRI / timezone-correct angle.** Why birth-time zone and DST get botched for diaspora charts, and how getting it right changes the reading. Speaks directly to the NRI half of the ICP — an underserved, high-intent niche.
4. **Relationship / decision use-cases.** "Is this a good week to have the hard conversation?" — practical, judgment-free, traces to transits. Demonstrates the product without doom.
5. **Panchang / muhurat "good day for X."** Timely, evergreen-on-a-loop, naturally shareable ("good day to start something"). Always framed as a helpful window, never "avoid or suffer."

**Per-shoot rule:** one sit-down shoot → one flagship video + 2–4 cut-downs (a 30s clip, a 12s hook teaser, a quote card, a "the why" close-up). One shoot should feed a week.

---

## 3. Platform mix & cadence (solo founder)

| Tier | Platform | Role | Cadence | Format |
|---|---|---|---|---|
| **Primary** | Instagram Reels | ICP lives here; saves/shares reward | 2–3/week | 9:16 short-form (the §2 pillars) |
| **Primary** | YouTube Shorts | Searchable; SEO title = a real query | 2–3/week (same cuts) | Same 9:16, retitled for search |
| **Secondary** | X (Twitter) | Build-in-public, founder credibility | 3–5 posts/week | Threads + the "shows its work" screenshots |
| **Secondary** | LinkedIn | Build-in-public for NRI professionals + investors/peers | 2–3/week | The honest-founder narrative, beta learnings |

**Repurpose 1 shoot → many cuts (the only sustainable solo workflow):**
1. Shoot one talking-head reading (the flagship).
2. Export the flagship → Reels + Shorts (retitle Short with the searched query).
3. Pull a 10–15s hook teaser → Reels/Shorts/X.
4. Pull the single best "the why" sentence → quote card (use the `/og`-style brand look) → IG + LinkedIn.
5. Write the reading up as an X thread (setup → factor → why → "interpretation, not fact").
6. Same thread, reframed for professionals → LinkedIn.

Batch the week's shoots in one sitting. Leave room for real-time: a panchang/muhurat post the night before, and replies to comments in the first hour (engagement window matters most then).

---

## 4. Four-week content calendar (template)

Columns: **Date | Platform | Pillar | Hook | CTA | Repurpose targets.** Weeks 1–2 filled as worked examples; weeks 3–4 are the blank template to clone. CTAs alternate between top-of-funnel ("follow / save") and the share loop ("get yours → share it"). Dates are placeholders — slot to your shoot days.

### Week 1 (example — filled)

| Date | Platform | Pillar | Hook | CTA | Repurpose targets |
|---|---|---|---|---|---|
| Mon | Reels + Shorts | 1 Myth-bust | "You've been told Mangal Dosha ruins marriages. Here's what your chart actually says." | "Pull your own chart — link in bio" | Short (retitle: "what is mangal dosha really"), X thread, quote card |
| Wed | Reels + Shorts | 2 Meter-never-runs | "Why pay-per-minute astrology is built to keep you talking." | "Same answer every time, no clock — try the beta" | Short, LinkedIn post, X teaser |
| Thu | X (thread) | 2 Build-in-public | "Day 1 of building astrology that shows its work. Here's the why behind today's reading 👇" | "Beta's open — reply for an invite" | LinkedIn repost, quote card |
| Fri | Reels + Shorts | 5 Panchang | "Good day to start something? Here's what this weekend's panchang says — and why." | "Get your day read → share it" (`daily_briefing` share) | Short, IG story, X post |
| Sat | LinkedIn | Build-in-public | "Bootstrapping an anti-fear-selling astrology app. What I got wrong about NRI birth times this week." | "Following the build? Connect." | X thread |

### Week 2 (example — filled)

| Date | Platform | Pillar | Hook | CTA | Repurpose targets |
|---|---|---|---|---|---|
| Mon | Reels + Shorts | 3 NRI/timezone | "If you were born in India but live abroad, your chart is probably wrong. Here's the one setting nobody fixes." | "Fix your birth time → get an honest reading" | Short (retitle: "nri birth time astrology"), LinkedIn, X teaser |
| Tue | X (thread) | 1 Myth-bust | "'Sade Sati will destroy 7.5 years of your life.' Let's actually read what Saturn is doing. 🧵" | "Read yours without the doom — beta link" | LinkedIn repost, quote card |
| Wed | Reels + Shorts | 4 Relationship | "Is this a good week for the hard conversation? Here's what the transits say — judgment-free." | "Ask your chart → share the result" (`kundli`/`daily_briefing` share) | Short, IG story, X post |
| Fri | Reels + Shorts | 1 Myth-bust | "Stop being scared of your 8th house. Here's what it actually means." | "See your houses explained — link in bio" | Short, quote card, X thread |
| Sat | LinkedIn | Build-in-public | "Why I won't add fake astrologer profiles, even though they'd convert. The honest version of this business." | "If this resonates, the beta's open." | X thread |

### Week 3 (template — clone and fill)

| Date | Platform | Pillar | Hook | CTA | Repurpose targets |
|---|---|---|---|---|---|
|  | Reels + Shorts |  |  |  |  |
|  | Reels + Shorts |  |  |  |  |
|  | X (thread) |  |  |  |  |
|  | Reels + Shorts |  |  |  |  |
|  | LinkedIn |  |  |  |  |

### Week 4 (template — clone and fill)

| Date | Platform | Pillar | Hook | CTA | Repurpose targets |
|---|---|---|---|---|---|
|  | Reels + Shorts |  |  |  |  |
|  | Reels + Shorts |  |  |  |  |
|  | X (thread) |  |  |  |  |
|  | Reels + Shorts |  |  |  |  |
|  | LinkedIn |  |  |  |  |

**Filling rule:** rotate all 5 pillars across the month; keep pillar 1 (myth-bust) as the weekly flagship; ensure at least one share-loop CTA (`daily_briefing` / `kundli`) per week so OG cards keep entering WhatsApp.

---

## 5. OG-share virality mechanics

India runs on WhatsApp forwards. A bare link dies in a group chat; a rich card gets forwarded. The `/match/[token]/og` card already nails this, and `SharedReading`'s card (§1b) inherits the same recipe.

**What makes a card screenshot/forward-worthy:**
- **A real, specific result, not a logo.** "Sun in Libra · 78%" or a named placement — concrete beats generic. The match card leads with the percentage and the names; the reading card leads with the placement + the "why" line.
- **The "why" is visible on the card.** The shows-its-work factor on the card itself is what makes it different from every other astrology forward and what makes the recipient curious enough to tap.
- **Big number / big contrast.** The match card's giant accent-colored percentage reads at a glance in a muted thumbnail. The reading card should carry one bold headline element the same way.
- **Renders correctly in any Indian language.** The `NOTO_INDIC` font loading means a Tamil or Bengali name shows as letters, not tofu — non-negotiable for forward-worthiness in this audience.
- **Branded but not salesy.** The `myastro360` wordmark is present and small; the result is the hero. Trust travels with the card.
- **Noindex + no birth data.** It's private enough to feel personal (people forward personal things) but safe to share (no DOB leaks).

**The WhatsApp-forward loop, concretely:** `ShareButton` prefers the native share sheet, falls back to a `wa.me/?text=` deep link, then copy. On mobile India that means one tap → WhatsApp → group/contact. The recipient sees the OG card unfurl → taps → lands on the noindex snapshot (which still shows the work) → hits "get yours" → generates their own → mints a new `SharedReading` → shares again. Every hop is a `share_clicked` event; every inbound click carries a UTM (§7). Optimize relentlessly for: *does the card make someone who didn't ask for astrology want to tap?*

---

## 6. Hooks bank (15 on-brand openers — zero fear-selling)

Use as video first-lines or thread openers. None threaten; all promise an honest explanation or a reframe.

1. "You've been told X about your chart. Here's what it actually says."
2. "Here's the why behind your reading — not just the what."
3. "Same chart, same answer, every time. Here's how that's even possible."
4. "If you were born in India but live abroad, your chart is probably set up wrong."
5. "Stop being scared of your 8th house. Here's what it really means."
6. "Let's actually read what Saturn is doing — minus the doom."
7. "Every line in your kundli traces back to a planet. Let me show you which."
8. "The honest version of what this placement means."
9. "Good day to start something? Here's what today's panchang says, and why."
10. "Astrology that shows its work. Watch me trace this reading to your chart."
11. "Here's what 'Mangal Dosha' means once you take the fear out of it."
12. "Your sign is the headline. The real story is in the houses. Here's yours."
13. "No meter, no clock, no upsell. Just your chart, explained."
14. "This is an interpretation, not a verdict. Here's how I'd read it."
15. "The one birth-time setting NRIs always get wrong — and how it changes everything."

---

## 7. Measurement — tie shares + UTMs to the analytics layer

Everything routes through `track()` in `apps/web/src/lib/analytics.ts`, which fans out to **GA4 (marketing/attribution sink)** and **PostHog (product/funnel sink)** with identical event names. Don't add a new analytics path — use the one that's live.

**Outbound (shares created):** `ShareButton` already fires `share_clicked {trigger, method}`.
- `trigger` ∈ `horoscope` (live) · `daily_briefing` · `kundli` (new from §1a) → tells you *which surface* drives sharing.
- `method` ∈ `native` · `whatsapp` · `copy` → confirms the WhatsApp-forward thesis (expect `whatsapp`/`native` to dominate on mobile India).
- Add `viewCount` on `SharedMatch` / `SharedReading` as the server-side proof a shared link was actually opened (the loop's denominator).

**Inbound (clicks back):** tag every CTA destination with a UTM so social ROI is attributable in GA4. Standardize:

| Source of click | `utm_source` | `utm_medium` | `utm_campaign` |
|---|---|---|---|
| Instagram Reels | `instagram` | `reels` | pillar slug (e.g. `myth-bust`) |
| YouTube Shorts | `youtube` | `shorts` | pillar slug |
| X | `twitter` | `social` | `build-in-public` |
| LinkedIn | `linkedin` | `social` | `build-in-public` |
| WhatsApp share card | `whatsapp` | `share` | `reading-loop` / `match-loop` |

**The viral coefficient (k), assembled from existing events:**
`k = (share_clicked per reading) × (snapshot click-through, from viewCount / shares) × (signup rate of those visitors)`. All three numerators already exist or are added above (`share_clicked`, `viewCount`, your existing signup/activation event such as the `trackOnce` first-signup milestone). Watch k weekly; the §1 build exists to push it toward 1.

**Weekly review (15 min):** top `trigger` by `share_clicked`; `method` split; `viewCount`-per-share by surface; `utm_source` → signup conversion. Move the next week's calendar (§4) toward whichever pillar/surface produces the most *opened* shares, not the most posted videos.
