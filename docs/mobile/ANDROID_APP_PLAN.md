# MyAstro360 Android App — Engineering Plan

**Stack:** Expo (React Native) · **Scope:** full feature parity in v1 · **Payments:** dual rail
(Cashfree web-consumption + Google Play Billing) · **E2E:** Detox · **Perf:** measured budgets.

Android-first; iOS ships later from the same codebase.

---

## Context

MyAstro360 is a Turborepo monorepo — `apps/web` (Next.js 15) + `apps/api` (NestJS 11 +
Prisma/Postgres) — deployed Web→Vercel, API→Railway (`https://api.myastro360.com/api`). The backend
is the single source of truth; **the mobile app is just another client of the same API** — we do not
rebuild the backend, we add a client.

Reuse, don't reinvent: the backend, the `provider`-neutral payment schema
(`gatewayOrderId`/`provider`), the idempotent status-guarded grant (`payment.service.ts:
settlePaidOrder`), `feature-access.service.ts` entitlements, the 12-language i18n TS objects, and the
`api.ts` client patterns (401 refresh, `ApiError`).

Confirmed decisions:
1. **Full feature parity in v1** — every web feature ships in the first Play Store release.
2. **Dual payment rails in parallel** — keep **Cashfree on web** (consumption model in-app) **and**
   add **Google Play Billing** in-app, with **region-gated anti-steering** (India forbids in-app
   links to web checkout; US/EU allow them). Grounded in the 2026 store-billing rules: AI
   content/credits/subscriptions are digital goods → store billing is mandatory in-app.
3. **Detox** for E2E; **robust performance** is a first-class requirement with measured budgets.

---

## 1. Monorepo & package structure

Add two workspaces (npm workspaces + `turbo.json` pipeline entries mirroring web/api):

```
apps/
  api/            NestJS (source of truth) — small additive changes (§8)
  web/            Next.js (unchanged)
  mobile/         NEW — Expo app (Expo Router, TS)
packages/
  shared/         NEW — code shared by web + mobile:
                    api-client (ported from apps/web/src/lib/api.ts),
                    types (API DTO types), zod schemas, i18n locale objects,
                    feature-gating helpers, constants, formatting utils
```

`packages/shared` is the linchpin: one API client + one set of types + one i18n corpus consumed by
both web and mobile. Web migrates its `lib/api.ts`, `lib/store.ts` types, and `i18n/*` imports to
`@myastro360/shared` incrementally (non-breaking).

## 2. Tech stack (Expo, managed workflow)

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Expo SDK (latest) + Hermes** | Managed builds, EAS, OTA; Hermes = fast startup / low memory |
| Navigation | **Expo Router** (file-based) | Mirrors the Next.js app-router mental model the team knows |
| Data fetching | **TanStack Query** | Caching, retries, offline persistence, background refetch |
| Client state | **Zustand** (reuse store shape) + **expo-secure-store** (tokens) + **react-native-mmkv** (cache/persist) | Same store contract as web; secure token storage |
| Styling | **NativeWind** (Tailwind for RN) | Reuse web Tailwind tokens (`primary`/`mystic`, `surface-card`, `text-gradient`) → visual parity |
| Animation | **Reanimated 3 + Gesture Handler** | 60fps native-thread animations |
| Lists | **FlashList** | Virtualized, low-memory long lists (chat, transactions, feeds) |
| Images | **expo-image** | Disk/mem caching, blurhash placeholders |
| Auth | **@react-native-firebase/auth** (phone OTP + Google) + backend `/auth/*` | Native OTP/Google; reuse backend JWT |
| Payments | **react-native-iap** (Play Billing) + Cashfree web deep-link (consumption) | §5 |
| Push | **expo-notifications + FCM** | Daily briefing / re-engagement |
| Errors/Perf | **Sentry (react-native)** + **react-native-performance** | Crash + perf telemetry |
| i18n | reuse locale objects + **i18next** (thin `t.*` hook) | 12 languages, portable TS objects |

## 3. Navigation & screen architecture (Expo Router)

The app is organized around **6 astrology traditions**, each with its own **dashboard** and
sub-features (registry: `apps/web/src/lib/traditions.ts`). Mobile reproduces that architecture.

- **Auth stack** (unauthenticated): welcome, sign-in (phone OTP / Google / email), OTP verify,
  birth-details onboarding (incl. **tradition selection** — `primaryTradition` + multi-select
  `astrologyTraditions[]`).
- **App tabs** (authenticated): **My Day** (cross-tradition) · **Explore** · **Chat** · **Reports** ·
  **Profile**.
- **Tradition switcher + dashboards:** a persistent tradition rail/switcher (Vedic · Western ·
  Chinese · Hellenistic · Horary · Medical) drives a per-tradition **dashboard** screen with its own
  accent theming (badge/hero colors from the registry) and the tradition's feature chips. Mirrors
  web's `AstrologyTraditionSelector` + `TraditionDashboard`.
- **Stack routes per feature** pushed from a dashboard/Explore. Tradition-scoped routing
  (`/western/natal`, `/vedic/dasha`, …) + top-level shared features (`/chat`, `/kundli`, `/horoscope`).
  Deep links (`myastro360://…` + universal links) for notifications and the payment return flow.
- Guard: a root layout reads Zustand auth state (hydrated from SecureStore) and redirects — same
  logic as web's `useAuthHydrated` gate; active tradition resolved like `resolveActiveTradition`.

## 4. Feature parity map — 6 traditions + cross-tradition features

The app spans **6 traditions** (`TraditionId`: VEDIC, WESTERN, CHINESE, HELLENISTIC, HORARY,
MEDICAL). Authoritative registries: web `apps/web/src/lib/traditions.ts`, API
`apps/api/src/modules/astrology/traditions/index.ts` + the Prisma tradition enum. **Every feature
below ships in v1** — one Detox suite per feature (§7). Gate: F=free, C=credit-gated,
E=entitlement/one-time-unlock, P=premium.

**🕉️ VEDIC** (flagship, 17 features)

Gate = **default policy (admin-tunable)** — F/C/E/P are the shipped defaults, but access is
resolved at runtime by `feature-access.service.ts` + SiteSettings (`pricing.credits.*`,
`feature.subscriptions_enabled`, `feature.free_mode`, entitlements), not hard-coded in the client.

| Feature | Route | API endpoint (verified vs controllers) | Gate |
|---|---|---|---|
| Chat with Astrologer | `/chat` | `POST /chat/message`, `POST /chat/stream`; `GET /chat/sessions`, `GET /chat/sessions/:id` | C |
| Kundli | `/kundli` | `POST /astrology/kundli` (also fetches `GET /astrology/dosha`) | C |
| Palmistry (camera) | `/palmistry` | `POST /palmistry/analyze` (multipart), `GET /palmistry/:id/status`, `GET /palmistry/:id/image` | E |
| Matching | `/matching` | `POST /astrology/matching` (share → cross-tradition table) | C |
| Horoscope | `/horoscope` | `GET /astrology/horoscope/:sign`, `GET /astrology/horoscope/:sign/multi` | F |
| Panchang | `/panchang` | `GET /astrology/panchang` | F |
| Muhurat | `/muhurat` | `POST /astrology/muhurat` | F/C |
| Decision Room | `/decision-room` | `POST /astrology/timing-decision` | C |
| Cosmic Calendar | `/cosmic-calendar` | `GET /astrology/cosmic-calendar?year=&month=&activity=` | F |
| Dasha | `/vedic/dasha` | **reuses `POST /astrology/kundli`** (dasha is in the kundli response — no dedicated route) | C |
| Dosha | `/vedic/dosha` | `GET /astrology/dosha` (+ `GET /astrology/sade-sati`, `GET /astrology/mitigation/:issue`) | C |
| Divisional charts | `/divisional` | `POST /astrology/divisional/:type` | C |
| KP astrology | `/kp-astrology` | `POST /astrology/kp-chart` | C |
| Numerology | `/numerology` | `POST /numerology/name`, `POST /numerology/brand`, `GET /numerology/personal-year` | F/C |
| Mulank | `/vedic/mulank` | `GET /numerology/mulank` | F/C |
| Tarot | `/tarot` | `POST /tarot/draw`, `GET /tarot/history` | C |
| Vastu | `/vastu` | `POST /vastu/analyze` | C |

**♈ WESTERN** (3): Natal `POST /astrology/western/natal` · Transits `POST /astrology/western/transits`
· Synastry `POST /astrology/western/synastry`.

**🐉 CHINESE** (3): BaZi (Four Pillars) `POST /astrology/bazi` · Zodiac `GET /astrology/chinese-zodiac/{year}`
· Flying Stars (Feng Shui) `GET /astrology/chinese/flying-stars?year=`.

**🏛️ HELLENISTIC** (3): Natal `POST /astrology/kundli` (shared engine, no extra charge) · Profections
`POST /astrology/hellenistic/profections` · Zodiacal Releasing `POST /astrology/hellenistic/zodiacal-releasing`.

**⌛ HORARY** (2): Ask a question `POST /astrology/horary/ask` · History = **client-side localStorage**
(`apps/web/src/app/horary/_history.ts`), **not** an API — mobile persists it locally (MMKV/AsyncStorage).
(Contrast: Tarot & Chat histories are server-side.)

**⚕️ MEDICAL** (2): Decumbiture chart `POST /astrology/medical/decumbiture` · Body/Zodiac (melothesia)
`GET /astrology/medical/body-zodiac`.

**Cross-tradition / global**

| Feature | Route | API endpoint(s) (verified vs controllers) | Gate |
|---|---|---|---|
| My Day / daily briefing | `/my-day` | `GET /daily-briefing` (+ `GET /daily-briefing/planetary-hours`, `GET /daily-briefing/offline-pack`), `GET /users/me` | F |
| Tradition dashboards (×6) | `/vedic` `/western` `/chinese` `/hellenistic` `/horary` `/medical` | `GET /astrology/traditions` (config) + registry (client) | F |
| Reports (Life/Career/Marriage/Wealth/Annual/Palm) | `/reports` | `POST /reports/generate`, `GET /reports/:id`, `GET /reports/:id/status`, `GET /reports` | E |
| **Deep-dive interpretation** (chart/report interpretation) | (invoked in-feature) | `POST /interpretation/deep-dive` (+ `POST /interpretation`) | C |
| **Match share** (share a compatibility result) | `/match/[token]` | `POST /astrology/matching/share`, `GET /astrology/matching/shared/:token` | F |
| Chat memory / personalization | (implicit in chat) | `GET/POST /memory`, `DELETE /memory/:id` | — |
| Pricing / buy credits & Premium | `/pricing`, `/checkout`, `/checkout/return` | `GET /payments/pricing`, `POST /payments/create-order`, `POST /payments/verify`, `POST /payments/subscribe`, `GET /payments/history`, `POST /payments/webhook` | — |
| Profile / credits / **tradition select** / language | `/profile` | `GET /users/me`, `PUT /users/me`, `GET /users/me/credits`; `POST /auth/change-password` | — |
| **Daily-briefing preferences** | (in Profile) | `GET /briefing/preferences`, `PUT /briefing/preferences` | — |
| Referral program | `/referral` | `GET /referral/me`, `GET /referral/preview` | — |
| Auth / sign-in | `/auth` | `POST /auth/{register,login,otp/send,otp/verify,google,firebase,refresh,logout,forgot-password,change-password,set-password}`, `GET /auth/status` | — |
| Password reset landing | `/reset-password` | Firebase (deep-link handler) | — |
| Paywall A/B experiment | (client) | `POST /experiment/paywall/{assign,link,convert}`, `GET /experiment/paywall/preview` | — |

> **Not an existing endpoint:** the earlier "Notifications center → `/notifications`" row was dropped —
> there is no notifications route or controller. In-app notifications + **FCM push + a new
> `POST /users/push-token`** are **new mobile+backend work** (tracked in §8), not an existing feature.

### 4.1 Complete website route inventory (authoritative) & mobile treatment

Enumerated from **every** `apps/web/src/app/**/page.tsx` (67 routes) so nothing is implicit. Mobile
treatment: **Screen** = a dedicated app screen; **In-feature** = a selector/tab inside a parent
screen; **Deep link** = handled via `myastro360://` / universal link, not a distinct screen;
**Excluded (v1)** = intentionally not in the mobile app.

| Web route(s) | Feature | Mobile treatment |
|---|---|---|
| `/` | Home / launcher | Screen (Explore/Home) |
| `/auth` | Sign-in (OTP/Google/email) | Screen (auth stack) |
| `/reset-password` | Password-reset landing | Deep link handler |
| `/profile` | Account, credits, settings, tradition-select, language, briefing prefs | Screen (Profile tab) |
| `/my-day` | Daily briefing | Screen (My Day tab) |
| `/pricing` · `/checkout` · `/checkout/return` | Buy credits/Premium; checkout return | Screen(s) (+ Play Billing) |
| `/referral` | Referral program | Screen |
| `/reports` | Reports hub (6 report types) | Screen (Reports tab) |
| `/vedic` `/western` `/chinese` `/hellenistic` `/horary` `/medical` | 6 tradition dashboards | Screen ×6 |
| `/chat` | Chat with Astrologer (streaming, memory, deep-dive) | Screen (Chat tab) |
| `/kundli` · `/kundli/cities` · `/kundli/[city]` | Kundli (+ SEO city pages) | Screen; city = **In-feature** picker; city URLs = Deep link |
| `/matching` · `/match/[token]` | Matching + shared result | Screen; shared result = Deep link |
| `/palmistry` | Palmistry (camera/upload) | Screen |
| `/horoscope` · `/horoscope/[sign]` · `/horoscope/[sign]/[period]` | Horoscope (+ SEO sign/period) | Screen; sign/period = **In-feature**; URLs = Deep link |
| `/panchang` · `/panchang/cities` · `/panchang/[city]` | Panchang (+ SEO city) | Screen; city = **In-feature**; URLs = Deep link |
| `/muhurat` | Muhurat | Screen |
| `/decision-room` | Decision Room | Screen |
| `/cosmic-calendar` | Cosmic Calendar | Screen |
| `/divisional` | Divisional charts | Screen |
| `/kp-astrology` | KP astrology | Screen |
| `/numerology` | Numerology | Screen |
| `/tarot` | Tarot | Screen |
| `/vastu` | Vastu | Screen |
| `/vedic/dasha` `/vedic/dosha` `/vedic/mulank` | Dasha (reuses kundli) · Dosha (+ Sade Sati, Remedies/Mitigation) · Mulank | Screen ×3 |
| `/western/natal` `/western/transits` `/western/synastry` | Western ×3 | Screen ×3 |
| `/chinese/bazi` `/chinese/zodiac` `/chinese/flying-stars` | Chinese ×3 | Screen ×3 |
| `/hellenistic/natal` `/hellenistic/profections` `/hellenistic/zodiacal-releasing` | Hellenistic ×3 | Screen ×3 |
| `/horary/ask` `/horary/history` | Horary Ask (API) · History (client-side localStorage, no API) | Screen ×2 |
| `/medical/decumbiture` `/medical/body-zodiac` | Medical ×2 | Screen ×2 |
| `/[locale]/…` (kundli, matching, muhurat, numerology, palmistry, vastu, tarot, horoscope/[sign], panchang/[city], home) | Locale-prefixed SEO duplicates of the above | **No new screens** — mobile does i18n in-app; these are web-SEO URLs |
| `/admin` | Admin console | **Excluded (v1)** — separate web app (a mobile admin is a later, optional track) |
| `/styleguide` | Dev component gallery | **Excluded (v1)** — internal only |

> **Count:** ~**33 interactive feature screens** + **6 tradition dashboards** + the account/monetization
> set. Localized `[locale]/*` routes add **0** mobile screens (i18n is in-app). `/admin` and
> `/styleguide` are excluded from v1.
>
> **Endpoints verified (not approximate):** every path in §4 was pinned by reading the live controllers
> (`apps/api/src/**/*.controller.ts`, all `/api`-prefixed) and the web call sites. Corrections applied:
> `daily-briefing` (not `/astrology/daily`), `/astrology/timing-decision` (not `/chat/decision`),
> `/astrology/cosmic-calendar`, `/astrology/kp-chart`, `/astrology/divisional/:type`,
> `/numerology/{name,brand,personal-year,mulank}`, `/vastu/analyze`, `/astrology/horoscope/:sign(/multi)`,
> `/interpretation/deep-dive`, `/astrology/matching/share` + `/shared/:token`, `/referral/{me,preview}`,
> `/briefing/preferences`. **Dasha** and **Hellenistic Natal** have no dedicated route — both reuse
> `POST /astrology/kundli`. **Sade Sati** (`GET /astrology/sade-sati`) and **Remedies/Mitigation**
> (`GET /astrology/mitigation/:issue`) are added as Dosha/My-Day sub-features. **Horary History** and
> **Notifications** are reclassified (client-side; new work) — see §4 notes.


## 5. Payments — dual rail with region-gated anti-steering

Entitlement is the source of truth; the UI adapts by store-policy region.

**Rail A — Cashfree "consumption" (web purchase):** the app reads balance/entitlement server-side at
login/refresh and lets users *consume*. Purchases happen in the browser (existing Cashfree flow, full
margin). In-app, an "Add credits / Upgrade" CTA that deep-links to the web checkout is shown **only
where anti-steering permits** (a `region` flag from the API / device locale gates it — hidden in
India). Elsewhere, users are steered to web via **push/email** (allowed everywhere).

**Rail B — Google Play Billing (in-app):** `react-native-iap` for consumable credit packs + a
subscription for Premium. On purchase → send the Play **purchase token** to a new backend verifier.

**Backend additions (reuse existing grant infra):**
- Extend the `provider` discriminator to `google_play` (and `apple_iap` later).
- `POST /payments/google/verify` → validate via the **Google Play Developer API**
  (`purchases.products` / `purchases.subscriptions`), then call the **same** idempotent
  `settlePaidOrder`/grant path (`payment.service.ts`).
- **Real-time Developer Notifications (RTDN)** via Pub/Sub → a webhook reusing the
  refund/renew/cancel handlers (analog of the Cashfree webhook; `payment-reconcile.service.ts`
  becomes per-provider).
- Apple 3.1.3(b) parity is deferred to the iOS phase, but the schema/design accommodates it now.
- (Considered, not chosen: RevenueCat abstracts Play + App Store billing + webhooks; we instead
  extend our own backend to avoid lock-in and reuse the grant logic we already hardened.)

## 6. Performance (robust — measured, not aspirational)

Budgets (enforced in CI where feasible): **cold start < 2.0s**, **TTI < 2.5s**, **60fps** scroll on a
mid-range Android (e.g. Pixel 4a), **release APK/AAB < ~30MB base**, **JS bundle tracked** per build.

Techniques:
- **Hermes** + **R8/ProGuard** minification for the release AAB; **EAS** production profile.
- **FlashList** for all long lists; **expo-image** with caching + blurhash; no inline
  functions/styles in list rows.
- **TanStack Query** cache + **MMKV persistence** → instant warm loads + offline reads (§9).
- **Reanimated** for UI-thread animations; **InteractionManager** to defer heavy work.
- **Expo Router lazy routes** + dynamic imports for heavy screens (charts).
- Memoized Zustand selectors (derive-once); `React.memo` on list items.
- **Reassure** perf-regression tests in CI (render timing); **Flashlight** / `react-native-performance`
  for startup + fps profiling on a device/emulator.
- Startup: minimal work before first paint; splash → skeletons; defer analytics/Sentry init.

## 7. Testing strategy — comprehensive

Four layers; the E2E matrix mirrors the team's Playwright `installApiMocks` philosophy on web.

**(a) Unit / component — Jest + React Native Testing Library.** Store, api-client (401 refresh,
`ApiError`), gating helpers, hooks, formatters, i18n, and each screen's render + interaction against a
**mocked API (MSW for RN)**. Target: high coverage on `packages/shared` (pure logic) + component
behavior.

**(b) Contract / API mocks.** An MSW-RN handler map (one per endpoint) = the mobile analog of web's
`installApiMocks`; unit + E2E consume it so happy paths run without a backend.

**(c) E2E — Detox on an Android emulator, in CI.** Gray-box, synchronized. One suite per feature row
(§4) plus cross-cutting journeys. **E2E test-case matrix:**

- **Auth:** phone OTP happy path; OTP wrong/expired; Google sign-in; email/password; token refresh on
  401; logout clears secure storage; deep-link resume.
- **Onboarding:** birth-details capture (date/time/place autocomplete) → profile persists.
- **My Day / Horoscope / Panchang / Cosmic Calendar (free):** load, render, tradition switch, error/retry.
- **Kundli / Matching / Dasha / Dosha / Divisional / KP / Numerology / Tarot / Muhurat (credit):**
  generate with sufficient credits → result renders; **insufficient credits → paywall**; credit
  decrement reflected.
- **Palmistry (entitlement + camera):** capture/upload image → analyze → reading; locked → checkout →
  unlock → generate; permission-denied path.
- **Reports (entitlement):** each report type — locked → purchase → generate → view/download; a failed
  generation refunds the entitlement (reflects backend `refundEntitlementByRef`).
- **Chat (streaming):** send message → streamed tokens render; session list; credit deduction;
  network-drop mid-stream recovery.
- **Decision Room:** multi-input decision → response.
- **Traditions (Western / Chinese / Hellenistic / Horary / Medical):** switch tradition via the rail
  → correct dashboard + accent theming; each sub-feature generates (Western natal/transits/synastry;
  Chinese bazi/zodiac/flying-stars; Hellenistic natal/profections/zodiacal-releasing; Horary
  ask + **local** history; Medical decumbiture/body-zodiac); per-feature credit/entitlement gating; primary +
  multi-select tradition persists to profile and re-resolves the active tradition on relaunch.
- **Payments — Rail A (consumption):** balance/entitlement read; region=IN → **no in-app web link**;
  region=US → deep-link to web checkout returns and reflects the new balance.
- **Payments — Rail B (Play Billing, sandbox):** buy a credit pack (test track) → backend verify →
  credits granted **exactly once** (idempotency); buy Premium sub → PREMIUM unlocked; cancel/refund via
  RTDN → access revoked; restore purchases.
- **Entitlement source-of-truth:** a web-purchased Premium unlocks in the app (consumption), and a
  Play-purchased Premium is honored — same `feature-access` result.
- **Cross-cutting:** language switch (all 12) re-renders; offline read of cached content; push-tap
  deep-links to the right screen; force-logout / refresh-token-revoked; low-memory/backgrounding.

**(d) Performance tests.** Reassure render-timing regressions in CI; a scripted startup+scroll
profiling run (Flashlight) on the emulator with pass/fail budgets (§6).

## 8. Backend changes (small, additive — `apps/api`)

1. `provider` extended to `google_play` (+ `apple_iap` reserved).
2. `POST /payments/google/verify` (Play Developer API validation → `settlePaidOrder`).
3. **RTDN** Pub/Sub webhook (renew/cancel/refund) reusing existing handlers; `payment-reconcile`
   becomes per-provider.
4. `POST /users/push-token` (register FCM device token) + a push-send hook in the
   notification/daily-briefing services.
5. CORS/allowed origins + universal-link/deep-link return URLs for the app.
6. Optional `region` / store-policy flag in `/payments/pricing` or `/users/me` to drive the
   anti-steering UI.

## 9. Offline, i18n, notifications, analytics

- **Offline:** TanStack Query + MMKV persistence — cached My Day / horoscope / kundli readable
  offline; mutations queued/retried; clear "offline" affordances. **Reuse the existing web caching
  layer** `apps/web/src/lib/offline-api.ts` (and the `GET /daily-briefing/offline-pack` endpoint it
  consumes) as the source pattern rather than inventing a new one.
- **i18n:** reuse the 12 locale TS objects from `@myastro360/shared`; a thin `t.*` hook; language
  persists in the store; per-locale number/date formatting.
- **Notifications:** expo-notifications + FCM; token registered on login; daily-briefing + re-engage
  pushes; tap → deep link.
- **Analytics:** reuse `track()` semantics with GA4 (Firebase Analytics) + PostHog RN SDK; identical
  event names to web for funnel continuity.

## 10. CI/CD & release (GitHub Actions + EAS)

- **PR checks (mobile):** typecheck, lint, Jest unit/component, **Detox E2E on an Android emulator**
  (ubuntu + KVM or a macOS runner), Reassure perf, **EAS Build preview APK**.
- **Release:** on tag → **EAS Build production AAB** → **EAS Submit** to Play Console **internal →
  closed → open → production** tracks. **EAS Update** for JS-only OTA fixes.
- **Play Console setup:** Google Play Developer account, Play App Signing, data-safety form, content
  rating, privacy policy, store listing, and Billing Library **v8+** (required for new apps by
  ~Aug/Nov 2026 — factor into the timeline).

## 11. Build sequencing (even for a full-parity v1)

- **P0 — Foundation:** `apps/mobile` + `packages/shared` scaffold, NativeWind theme from web tokens,
  Expo Router shell, EAS + CI, Sentry. Move api-client / types / i18n into shared.
- **P1 — Auth + shell:** auth stack (OTP/Google/email), onboarding (incl. **tradition select**),
  tabs, **tradition switcher + dashboard shell** (6 traditions, accent theming), My Day, Profile
  (credits, language, **referral**, **daily-briefing preferences**), i18n, offline cache. + unit/E2E.
- **P2 — Vedic features (17):** horoscope, panchang, cosmic calendar, kundli, matching, dasha (reuses
  kundli), dosha (+ Sade Sati + Remedies/Mitigation), divisional, KP, numerology (name/brand/personal-year),
  mulank, tarot, muhurat, vastu, decision-room. + E2E per feature.
- **P3 — Other 5 traditions:** Western (natal/transits/synastry), Chinese (bazi/zodiac/flying-stars),
  Hellenistic (natal reuses kundli / profections / zodiacal-releasing), Horary (ask via API; history
  stored locally), Medical (decumbiture/body-zodiac) + their dashboards. + E2E per feature.
- **P4 — Rich features:** Chat (streaming + **memory** + **deep-dive interpretation**), Reports (all 6
  types), Palmistry (camera), **Match share** (`/match/[token]`). + E2E.
- **P5 — Payments dual-rail:** consumption read + region-gated CTA; Play Billing + backend verify +
  RTDN; paywalls. + payment E2E (sandbox).
- **P6 — Notifications + performance hardening:** FCM push, perf budgets / Reassure / Flashlight,
  bundle trim, offline polish.
- **P7 — Full Detox suite + Play release pipeline:** green E2E matrix, internal→production tracks.

## 12. Critical files / directories (created during implementation)

- `apps/mobile/` (Expo app: `app/` routes, `src/` components/hooks/theme, `e2e/` Detox, `.detoxrc`,
  `eas.json`, `app.config.ts`)
- `packages/shared/` (`api-client.ts` ported from `apps/web/src/lib/api.ts`, `types/`, `i18n/`,
  `gating.ts`)
- `apps/api/src/modules/payment/` (Google verify + RTDN), `apps/api/src/modules/user/` (push-token)
- `.github/workflows/mobile-ci.yml`

## 13. Verification (how we prove it works)

- `apps/mobile`: `npx expo start` / `expo run:android`; **Detox** (`detox test -c android.emu.debug`)
  green across the §7 matrix on an emulator.
- Unit/component: `jest` green with high coverage on `packages/shared`.
- Payments: a Play Billing **sandbox/internal-test** purchase → backend grants **exactly once**; RTDN
  cancel → revoke; the consumption path reflects web purchases; the anti-steering UI is hidden in IN.
- Performance: a Reassure CI gate + a Flashlight run meeting the §6 budgets.
- Build/release: **EAS Build** AAB + **EAS Submit** to the Play internal track; smoke on a real device.
- Backend deltas covered by `apps/api` Jest tests (reuse the payment idempotency test patterns).

---

_See also: [`docs/MONETIZATION_STRATEGY.md`](../MONETIZATION_STRATEGY.md),
[`docs/CASHFREE_SECURITY_REVIEW.md`](../CASHFREE_SECURITY_REVIEW.md),
[`docs/observability/README.md`](../observability/README.md)._
