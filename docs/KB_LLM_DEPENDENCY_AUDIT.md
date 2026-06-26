# KB vs LLM Dependency Audit & KB-Strengthening Plan

> **Scope:** Every astrology feature and its meaning/interpretation layer.
> **Excluded:** Chat (intentionally LLM-driven; out of scope per request).
> **Goal:** Map what each feature depends on — deterministic compute, the
> Knowledge Base (`Kb*` tables), or the LLM — and lay out a concrete plan to
> shift interpretation work off the LLM and onto a strengthened KB.

---

## TL;DR

- **The numbers are already free and deterministic.** Every chart, score, and
  date (kundli, dasha, divisional, KP, matching, panchang, transits, Western,
  Chinese, BaZi, Hellenistic, medical) is computed with Swiss Ephemeris or plain
  math. No LLM touches the calculation.
- **The words are the split.** Some features already render their meaning from
  the KB in 12 locales (dosha, numerology, My Day, Chinese zodiac, medical,
  Western, Hellenistic). Others fall back to the LLM for "what does this mean
  for me" because **the KB has no combination/placement tables**.
- **The single biggest avoidable LLM dependency** is the missing *placement
  interpretation library* (planet-in-house, planet-in-sign, house meaning, yoga
  meaning, dasha impact). Building it converts ~6 high-traffic features from
  LLM-required to LLM-optional.
- **Keep on LLM:** reports, horoscopes, palmistry (vision), tarot, free-text
  vastu. These are open-ended prose/vision/synthesis and a table can't replace
  them without making them worse.

---

## 1. Dependency Matrix

Three buckets. The key distinction throughout: **the numbers** (positions,
scores, dates — always deterministic) vs **the words** (the interpretation).

### 🟢 Deterministic numbers + KB words — *zero LLM today*

Already where we want every feature to be: math computes the result, KB renders
the meaning across 12 locales.

| Feature | Numbers (compute) | Words (KB table) |
|---|---|---|
| Dosha analysis | Swiss Ephemeris | `KbDosha` |
| Numerology (name / brand / mulank) | math | `KbNumberMeaning`, `KbBusinessSector`, `KbPersonalYearTheme` |
| My Day / daily briefing | math | `KbBriefingPhrase` |
| Chinese zodiac + flying stars | math | `KbChineseAnimal`, `KbFlyingStar` |
| Medical body-zodiac | math | `KbZodiacSign` |
| Western natal / synastry / transits | Swiss Ephemeris | `KbZodiacSign`, `KbPlanet` |
| Hellenistic profections / zodiacal releasing | math | `KbHellenisticPlanet` |
| BaZi / decumbiture | math | KB |

### 🟡 Deterministic numbers, but the *interpretation* is LLM (or missing)

The chart/score/date is exact and free. The "so what does this mean for me"
layer is the new `interpretation:*` LLM call (or, for gochar, hardcoded English).
**These are the reduction targets.**

| Feature | Numbers | Meaning layer today | Why it falls to LLM |
|---|---|---|---|
| Kundli (chart, planets, houses) | Swiss Ephemeris ✅ | LLM interpretation | no placement KB |
| Vimshottari dasha | exact ✅ | LLM interpretation | no dasha-impact KB |
| Divisional charts (D-9, etc.) | exact ✅ | LLM interpretation | no placement KB |
| KP chart | exact ✅ | LLM interpretation | no placement KB |
| Matching (ashtakoota) | exact ✅ | LLM interpretation | no koota-meaning KB |
| Decision room / cosmic calendar | exact ✅ | LLM interpretation | thin KB |
| Panchang / Muhurat | exact ✅ | **optional** LLM enrichment | tithi/yoga/karana lack guidance text |
| Gochar (transits) | exact ✅ | hardcoded **English** strings | not in KB i18n yet |

### 🔴 Genuinely LLM-dependent — *keep on LLM*

Open-ended prose, vision, or cross-element synthesis. No KB table can replace
these without degrading them.

| Feature | Why it stays on LLM |
|---|---|
| **Reports** (full / premium) | Long-form personalized synthesis — biggest cost, but it is the product |
| **Horoscopes** (daily + multi-tradition) | Fresh, varied prose every day |
| **Palmistry** | Vision model reads the uploaded photo |
| **Tarot** | Synthesis across a drawn spread |
| **Vastu** | Free-text room/layout description as input |

---

## 2. The Critical Gap

The KB has **19 tables, all 12-locale complete** — but they all describe
**single entities**: a planet, a sign, a nakshatra, a number, an animal. There
are **no combination tables**, and combinations are exactly where chart
interpretation lives.

Missing tables:

- ❌ **planet-in-house** (e.g. "Saturn in the 7th")
- ❌ **planet-in-sign**
- ❌ **house meaning**
- ❌ **yoga meaning** (Gajakesari, Raja yogas, etc.)
- ❌ **dasha impact** (what a Jupiter mahadasha does)
- ❌ **koota meaning** (why Nadi koota scored 0/8)
- ❌ **aspect meaning**

Because none of these exist, **every** Kundli / dasha / matching / divisional
interpretation falls through to the LLM. This is the single largest source of
avoidable LLM dependency in the app.

### Existing KB tables (for reference)

`KbPlanet`, `KbNakshatra`, `KbTithi`, `KbYoga`, `KbVara`, `KbPaksha`,
`KbProfessionInsight`, `KbBriefingPhrase`, `KbNumberMeaning`, `KbBusinessSector`,
`KbPersonalYearTheme`, `KbReportSection`, `KbZodiacSign`, `KbChineseAnimal`,
`KbFlyingStar`, `KbKarana`, `KbDosha`, `KbHellenisticPlanet`.

---

## 3. KB-Strengthening Plan

### Core unlock — a "placement interpretation library" (highest leverage)

Five new tables, **tradition-scoped** (the `(key, tradition)` compound-unique
pattern) so the same schema serves Vedic, Western, and Hellenistic from
tradition-tagged rows.

| New table | Approx. rows | Unlocks |
|---|---|---|
| `KbPlanetInHouse` | ~84 (7–9 planets × 12 houses) | Kundli, KP, divisional, Western natal |
| `KbPlanetInSign` | ~84 | same |
| `KbHouseMeaning` | 12 | every chart |
| `KbYogaMeaning` | ~20 | yoga callouts |
| `KbDashaImpact` | ~9 | Vimshottari dasha |

**Effect:** the interpretation endpoint can **assemble** a reading from KB rows —
deterministic, free, instantly multilingual — and call the LLM only to weave the
rows into flowing prose (or skip it entirely on a free tier). This converts
kundli, dasha, divisional, KP, and matching from *LLM-required* to
*LLM-optional*, which is the bulk of `interpretation:*` traffic.

### Quick wins — content-only, no new schema, ship first

1. **Complete the `KbDosha` payload** → retire the hardcoded English
   `DOSHA_EN_REMEDIES` and remedy descriptions. (Temple data already lives in
   `apps/api/src/modules/astrology/remedy-temples.ts`.)
2. **Enrich `KbTithi` / `KbYoga` / `KbKarana`** with guidance text → **drop the
   LLM panchang enrichment call** entirely.
3. **`KbTransitAlert`** → move gochar's hardcoded English into KB i18n.
4. **`KbKootaMeaning` + muhurat-purpose rows** → matching & muhurat become
   KB-assembled.

### Two hygiene fixes

- **Adopt `KbService.renderStatus().matched` everywhere** so a missing row logs
  a real miss instead of silently serving English. Without this we can't measure
  KB coverage or know when a placement is absent.
- **Compute ephemeris at report-generation time** so reports stop leaning on
  stale LLM-supplied positions.

### Keep on LLM (do not fight this)

Horoscopes, palmistry vision, tarot synthesis, free-text vastu, the premium
report tier, and the *free-form* interpretation domains where no structured
placement exists.

---

## 4. Net Effect

| Outcome | Features |
|---|---|
| **Eliminated** (LLM call removed) | panchang enrichment, gochar hardcoding, dosha English duplication |
| **Made optional** (KB-assembled; LLM only for polish) | kundli, dasha, divisional, KP, matching, muhurat |
| **Unchanged** (correctly LLM) | reports, horoscopes, palmistry, tarot, vastu |

The placement library is ~210 content rows **per locale**, but it is
**write-once** and pays back across the most-used features. The quick wins need
no schema change at all.

---

## 5. Suggested Build Order

1. **Quick wins first** — `KbDosha` completion + panchang → KB. Immediate
   LLM-call removal, low risk, no schema migration.
2. **Placement library** — schema + seed (`apps/api/prisma/seed-kb/data/`) +
   wire the interpretation endpoint to prefer KB-assembled output and fall back
   to LLM only when a placement row is missing.
3. **Hygiene** — `renderStatus().matched` adoption + report-time ephemeris.

Each step is independently shippable and verifiable (existing Jest/Vitest
suites + i18n parity test stay green).
