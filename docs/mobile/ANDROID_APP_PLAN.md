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

- **Auth stack** (unauthenticated): welcome, sign-in (phone OTP / Google / email), OTP verify,
  birth-details onboarding.
- **App tabs** (authenticated): **My Day** · **Explore** (feature grid) · **Chat** · **Reports** ·
  **Profile**.
- **Stack routes per feature** pushed from Explore/My Day. Deep links (`myastro360://…` + universal
  links on `myastro360.com`) for notifications and the payment return flow.
- Guard: a root layout reads Zustand auth state (hydrated from SecureStore) and redirects — same
  logic as web's `useAuthHydrated` gate.

## 4. Feature parity map (all web features → mobile screens → API)

Every feature below ships in v1, consumed via `@myastro360/shared` api-client. Gate column: F=free,
C=credit-gated, E=entitlement/one-time-unlock, P=premium/subscriber.

| Feature | Screen(s) | Key API endpoints (`/api` prefix) | Gate |
|---|---|---|---|
| My Day / daily briefing | `my-day` | `/astrology/daily`, `/users/me` | F |
| Horoscope | `horoscope` | `/astrology/horoscope` (multi-tradition) | F |
| Chat with Astrologer | `chat`, `chat/[id]` | `/chat/message` (stream), `/chat/sessions` | C |
| Kundli | `kundli` | `/astrology/kundli` | C |
| Kundli Matching | `matching` | `/astrology/matching` | C |
| Palmistry (camera/upload) | `palmistry` | `/palmistry/analyze` (image upload) | E |
| Panchang | `panchang` | `/astrology/panchang` | F |
| Muhurat | `muhurat` | `/astrology/muhurat` | F/C |
| Reports (Life/Career/Marriage/Wealth/Annual/Palm) | `reports`, `reports/[type]` | `/reports/generate`, `/reports/:id` | E |
| Tarot | `tarot` | `/tarot/draw` | C |
| Numerology | `numerology` | `/astrology/numerology` | F/C |
| Dasha periods | `dasha` | `/astrology/dasha` | C |
| Dosha check | `dosha` | `/astrology/dosha` | C |
| Divisional charts | `divisional` | `/astrology/divisional` | C |
| KP astrology | `kp` | `/astrology/kp` | C |
| Decision Room | `decision-room` | `/chat/decision` | C |
| Cosmic Calendar | `cosmic-calendar` | `/astrology/calendar` | F |
| Pricing / buy credits & Premium | `pricing`, `checkout` | `/payments/pricing`, `/payments/create-order`, `/payments/verify`, `/payments/subscribe` | — |
| Profile / credits / settings / language | `profile`, `settings` | `/users/me`, `/auth/change-password`, `/payments/history` | — |
| Notifications center | `notifications` | `/notifications` | — |

> Implementation confirms exact endpoint paths against the live controllers
> (`apps/api/src/modules/*`) and the web usages in `apps/web/src/lib/api.ts`; the table is the parity
> checklist — one Detox suite per row (§7).

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
  offline; mutations queued/retried; clear "offline" affordances.
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
- **P1 — Auth + shell:** auth stack (OTP/Google/email), onboarding, tabs, My Day, Profile, i18n,
  offline cache. + unit/E2E.
- **P2 — Free + credit features:** horoscope, panchang, cosmic calendar, kundli, matching, dasha,
  dosha, divisional, KP, numerology, tarot, muhurat. + E2E per feature.
- **P3 — Rich features:** Chat (streaming), Reports (all types), Palmistry (camera). + E2E.
- **P4 — Payments dual-rail:** consumption read + region-gated CTA; Play Billing + backend verify +
  RTDN; paywalls. + payment E2E (sandbox).
- **P5 — Notifications + performance hardening:** FCM push, perf budgets / Reassure / Flashlight,
  bundle trim, offline polish.
- **P6 — Full Detox suite + Play release pipeline:** green E2E matrix, internal→production tracks.

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
