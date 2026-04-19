# Claude Design Brief — Jyotron

A single, self-contained prompt for "Claude Design" to redesign the Jyotron
website end-to-end. Paste everything below the divider into the design agent.

---

## 1. Product snapshot

**Jyotron** is an AI-powered astrology platform (web + iOS + Android) that
delivers personalised consultations, chart analyses, palm readings, daily
briefings and spiritual guidance across **six traditions**:

| Tradition    | Color anchor | Slug           | Core features                                              |
|--------------|--------------|----------------|------------------------------------------------------------|
| Vedic        | Amber        | `/vedic`       | Chat, Kundli, Matching, Horoscope, Panchang, Muhurat, Dasha, Dosha, Divisional, KP, Palmistry, Numerology, Tarot, Vastu |
| Western      | Sky          | `/western`     | Natal, Transits, Synastry                                  |
| Chinese      | Red          | `/chinese`     | BaZi, Zodiac, Flying Stars                                 |
| Hellenistic  | Violet       | `/hellenistic` | Natal, Profections, Zodiacal Releasing                     |
| Horary       | Teal         | `/horary`      | Ask a question, History                                    |
| Medical      | Emerald      | `/medical`     | Decumbiture, Body Zodiac                                   |

On top of traditions sits a **My Day** dashboard — a cross-tradition daily
briefing (quality score, lucky color/number/time, planetary hora, mantra,
panchang, do/avoid list, transit alerts).

**Monetization** is a freemium ladder: free tier, ₹499/mo Premium,
₹4,999/yr Annual, credit packs (10/50/100 questions), premium PDF reports
(₹599–999), per-scan palmistry (₹199).

**Stack** Next.js 15 App Router, TypeScript, Tailwind v4 (CSS variables in
`apps/web/src/app/globals.css`), Framer Motion, Zustand, i18n across 12
Indian languages, Firebase phone/email auth + backend OTP fallback.

## 2. Current design DNA (preserve the good parts)

- Dark-first, Apple-inspired: `--color-surface-950: #09090b`, zinc neutrals,
  ultra-thin hairline borders at `rgba(255,255,255,0.06)`.
- Primary indigo ramp (`#6366f1`), warm amber accent (`#f59e0b`).
- Signature text-gradient (indigo → violet → fuchsia) on hero highlights.
- Mesh-drift radial blobs animating behind the hero.
- Glass surfaces (20–32px blur, 120–140% saturation) for sticky nav/rails.
- Inter as the only font family — display and body.
- `surface-card`, `surface-card-hover`, `glass`, `meatball`, `fade-in-up`
  utilities are already defined in `globals.css` — keep their names; redesign
  inside them so existing pages don't have to be rewritten to adopt the new
  look.

**Do not ship a "generic SaaS" redesign.** The brand must read as
*mystical + technical* — precise typography, hairline rules, luminous
accents, never kitsch.

## 3. Current navigation model (keep the information architecture)

Three stacked bars at the top of every page:

1. **Navbar (fixed, h-16):** logo, language switcher, Reports, Pricing,
   profile/login — collapses into a hamburger below `lg`.
2. **TraditionRail (sticky, `top-16`):** horizontal scroller of the seven
   pills — `My Day` + 6 traditions. Framer Motion `layoutId` animates the
   active indicator. Selecting a pill routes to `/<slug>` and persists
   `primaryTradition` on the user (backend + Zustand store).
3. **FeatureChips (sticky, `top-[124px]`):** per-tradition feature chips
   (e.g. Vedic shows Chat/Kundli/Matching/…). Hidden on `/my-day`.

This three-tier rail is the product's navigation spine. You may restyle it,
re-space it, or collapse chips on scroll — but **do not remove any tier**,
and do not lose the tradition-switch flow (pill tap → route + persist).

## 4. Known UX pain points to fix

- Stacked 16 + 48 + 44 ≈ **108 px of chrome** before content. On mobile this
  eats the fold. Design a denser, possibly merged, possibly on-scroll
  collapsing variant.
- The BentoSummary on the logged-out home shows a static "Saffron / 7 / Sun"
  — it looks like real data but isn't. Redesign so the logged-out bento is
  clearly **a teaser** (blur + "unlock" affordance) without hiding the
  visual richness.
- The hero stats row ("24/7 · <2s · 95% · 100K+") is marketing-claim-heavy
  and reads generic. Either substantiate with social proof (testimonials,
  app-store ratings, press) or replace with a live value ticker (e.g. "a
  Kundli generated 12 seconds ago in Pune").
- No visible path from home → "which tradition is right for me?" for new
  users. Users land not knowing the difference between Vedic/Western/etc.
  Propose an onboarding affordance (a 3-tap quiz, a comparison card, or an
  ambient tradition-picker in the hero).
- The Auth page supports phone-OTP, email+password, Google, backend-OTP
  fallback, forgot-password — four branches crammed into one screen. Design
  a cleaner progressive-disclosure flow.
- My Day is information-dense (8+ data cards). Work out a true bento
  hierarchy: one hero card (day quality), secondary ring (lucky/hora),
  tertiary details behind a "more" affordance.
- Pricing page currently lists plans + credit packs + premium reports in
  one wall. Design a pricing narrative: anchor on Premium, show the ladder
  visually, make the credit math obvious.
- Footer social links go to `#`. Either wire them up or remove them.

## 5. User-flow changes I want you to propose (explicitly)

Return each with a before/after sketch or ASCII:

1. **First-visit flow** — home → "pick your path" → tradition dashboard →
   feature. Should a new user see a modal, a hero quiz, or be routed to a
   personalised `/discover` page?
2. **Sign-up flow** — is it worth delaying auth until after the user has
   tried a free Kundli / palm scan? Guest-first trial could materially lift
   conversion.
3. **My Day empty state** — currently hidden behind auth. Consider a
   "preview My Day with a sample chart" CTA for logged-out users.
4. **Chat / consultation entry** — today `/chat` is one of 14 Vedic chips.
   It is the highest-revenue surface. Should it get a persistent floating
   CTA ("Ask Jyotron") on every page?
5. **Tradition switching when a user has multiple traditions selected** —
   current rail routes on tap. Consider a secondary affordance (a slow
   hover-preview of that tradition's My Day) before committing.
6. **Payment flow** — Razorpay is the processor. Design a minimal three-step
   checkout: pick plan → confirm → pay. Keep the "₹499/mo" visible through
   every step so users never feel hijacked.

## 6. Scope of the redesign — every route must stay

Do not drop or gate any feature. Every route listed here must still render
and still do what it does today, even if the layout and hierarchy change:

```
/                          marketing home (hero + bento + how-it-works + CTA)
/auth                      login / signup (phone OTP · email · Google · reset)
/profile                   user profile + tradition multi-select
/my-day                    cross-tradition daily briefing
/chat                      AI consultation
/kundli                    Vedic birth chart generator
/matching                  Ashtakoota guna milan
/horoscope                 daily/weekly/monthly/yearly
/panchang                  Hindu calendar
/muhurat                   auspicious-date finder
/palmistry                 camera-based palm reading
/numerology                numerology tools
/tarot                     tarot spreads
/vastu                     vastu analysis
/kp-astrology              KP system tools
/divisional                divisional charts (D1–D60)
/vedic/dasha               dasha periods
/vedic/dosha               dosha detection + remedies
/western/natal             western natal chart
/western/transits          western transits
/western/synastry          western synastry
/chinese/bazi              BaZi (four pillars)
/chinese/zodiac            Chinese zodiac
/chinese/flying-stars      flying-stars Feng Shui
/hellenistic/natal         Hellenistic natal
/hellenistic/profections   annual profections
/hellenistic/zodiacal-releasing   zodiacal releasing
/horary/ask                ask a horary question
/horary/history            past horary questions
/medical/decumbiture       medical decumbiture
/medical/body-zodiac       body zodiac
/pricing                   plans + credit packs + premium reports
/reports                   user's premium reports library
/reset-password            password reset
/admin                     admin console (ADMIN role only)
```

## 7. Deliverables

Produce a **world-class, award-caliber** redesign targeting Awwwards SOTD /
CSS Design Awards / FWA tier. Deliver:

### 7a. Design system

- Refined color tokens (dark as default, must also ship a fully thought-out
  **light mode** — current code is dark-only). Preserve the
  `--color-primary-*`, `--color-accent-*`, `--color-surface-*` naming in
  `apps/web/src/app/globals.css`.
- A **six-tradition palette** system: each tradition gets a signature
  gradient, glyph treatment, and motion personality. Keep the existing
  anchor colors (amber/sky/red/violet/teal/emerald).
- Typography: stay on Inter OR propose exactly one display face (e.g. a
  serif like Fraunces for mystical headlines + Inter for UI). Ship a scale:
  display XL / display L / H1 / H2 / H3 / body L / body / caption.
- A real motion system (easings, durations, page-transition choreography).
  Today motion is ad-hoc — mesh-drift + framer-motion `layoutId`.
- Iconography: the app is emoji-heavy (🕉️, ♈, 🐉, ✋…). Decide whether to
  keep emoji (fast, universal, playful) or commission a custom glyph set.
  Justify the choice.
- Illustration direction for the six traditions. Aim for something that
  feels like NASA/Apollo meets Sanskrit manuscript — not stock astrology
  clipart.

### 7b. Page designs (desktop + mobile, light + dark)

Required screens, in priority order:

1. Landing `/` — hero, bento teaser, tradition carousel, social proof,
   pricing teaser, footer.
2. Auth `/auth` — progressive disclosure of phone / email / Google / reset.
3. My Day `/my-day` — the signature surface. Design the single most
   beautiful daily-briefing layout the web has seen.
4. Tradition dashboards `/vedic`, `/western`, `/chinese`, `/hellenistic`,
   `/horary`, `/medical` — each visually distinct, same structural skeleton.
5. Chat `/chat` — conversational UI with credit counter, specialized-agent
   picker (career, relationships, finance, health, spiritual), streaming
   response.
6. Kundli `/kundli` — birth-data form → north/south-Indian chart render →
   planetary table → dasha timeline.
7. Palmistry `/palmistry` — camera capture + upload, live guideline
   overlay, result card with labeled palm diagram.
8. Pricing `/pricing` — plan ladder + credit packs + premium reports.
9. Reports `/reports` — library, with PDF preview.
10. Profile `/profile` — identity + tradition multi-select + language.

### 7c. Componentry

Redesign the three navigation tiers (Navbar, TraditionRail, FeatureChips)
as a single coherent system — possibly with scroll-collapse behavior that
merges them into a compact command bar once the user scrolls past the
hero. Ship:

- A command-palette-style `⌘K` launcher (deep-link to any feature).
- A persistent floating "Ask Jyotron" CTA for logged-in users.
- A paywall/upsell component family (inline lock, blurred preview, upgrade
  sheet) reusable across every feature.
- Empty states, error states, loading skeletons, and a real
  `prefers-reduced-motion` story for every animated surface.

### 7d. Accessibility + i18n

- WCAG 2.2 AA minimum, AAA for body text where feasible.
- 12 Indian-language + English locales: design for Devanagari, Tamil,
  Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Oriya, Assamese,
  Marathi. Line-height and number-rendering must survive every one.
- RTL is not required today but leave the layout RTL-ready.

### 7e. Spec handoff

For each final screen give:

- Figma frame + exportable component list.
- Tailwind-token mapping (explicit `--color-*` values → class names) so an
  engineer can apply the changes inside existing files under
  `apps/web/src/app/**` and `apps/web/src/components/**` without renaming
  the existing utility classes (`surface-card`, `glass`, `btn-primary`,
  `text-gradient`, `meatball`, `fade-in-up`).
- Motion spec (trigger, easing, duration, reduced-motion fallback).
- A one-page "what to build first" engineering plan, ordered by user
  impact vs. implementation cost.

## 8. Constraints and non-negotiables

- Keep every feature and every route from §6. Nothing gets deprecated.
- Keep the three-tier navigation IA (Navbar → TraditionRail → FeatureChips)
  even if you visually merge them.
- Keep indigo-primary / amber-accent brand anchors, and the per-tradition
  color map in `apps/web/src/lib/traditions.ts` (amber / sky / red / violet
  / teal / emerald).
- Keep the existing utility class names in `globals.css` — restyle them,
  don't rename them.
- Must work on low-end Android (target: < 100 KB CSS, < 200 KB JS on the
  landing route, LCP < 2.0 s on 3G Fast).
- Must gracefully degrade when `prefers-reduced-motion` is set.
- Must not depend on any paid/closed font — Inter OK, Google-hosted
  display face OK.

## 9. Success criteria

The redesign earns Awwwards Site of the Day, ranks in CSS Design Awards'
monthly top three, and moves these product metrics:

- Landing → signup conversion **+30 %**.
- Auth completion rate **+15 %** (fewer drop-offs on OTP).
- Free → paid conversion **+20 %** (better pricing + chat CTA).
- 30-day retention **+25 %** (My Day must become a daily-open habit).

Make it beautiful. Make it precise. Make every route feel inevitable.
