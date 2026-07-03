# @myastro360/mobile

Expo (React Native) client for MyAstro360. Android-first; iOS ships later from
the same codebase. Full plan: [`docs/mobile/ANDROID_APP_PLAN.md`](../../docs/mobile/ANDROID_APP_PLAN.md).

The backend (`apps/api`) is the source of truth — this is another client of the
same API. Shared code (api-client, verified endpoint map, tradition registry,
gating, DTO types) lives in [`@myastro360/shared`](../../packages/shared).

## What's here (P0 + P1 shell)

- **Navigation:** Expo Router — entry gate (`app/index.tsx`) → `(auth)` stack
  (sign-in, onboarding) or `(tabs)` (My Day · Explore · Chat · Reports ·
  Profile). Registry-driven tradition dashboards (`app/tradition/[slug]`) and a
  generic feature screen (`app/feature/[slug]`) that makes all 6 traditions and
  their features navigable, each mapped to its verified endpoint.
- **State/data:** Zustand auth store (tokens in `expo-secure-store`, profile in
  MMKV) + TanStack Query with MMKV persistence for offline reads.
- **Theme:** NativeWind with tokens mirrored from the web design system
  (Warm Linen canvas, burnt-orange accent).
- **Vertical slice proven:** email/password sign-in → `POST /auth/login`;
  My Day → `GET /daily-briefing`.
- **Testing:** Jest (`src/**/*.test.ts`) + Detox (`e2e/`). Sentry wired.

## Setup

```bash
# from the repo root — installs web + api + shared only
npm install
# mobile is a standalone project with its own lockfile
cd apps/mobile && npm install
npm run align        # npx expo install --fix — reconcile native versions
npm start            # expo start
```

Add the binary assets in `assets/` (see `assets/README.md`) before building.

### Env

| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API base (default `https://api.myastro360.com/api`) |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN (init is a no-op when unset) |
| `EAS_PROJECT_ID` | EAS project id for builds |

## Monorepo / CI note

`apps/mobile` is intentionally **not** a root npm workspace — it has its own
`package-lock.json` and pulls `@myastro360/shared` via a `file:` link. So a root
`npm ci` (the web/api jobs in `.github/workflows/ci.yml`) installs only
**web + api + shared** — the React Native/Expo tree never touches those jobs and
the root lockfile stays lean. Mobile installs separately with
`cd apps/mobile && npm ci` in `.github/workflows/mobile-ci.yml`. RN/Expo peers
are pinned via `apps/mobile`'s own `overrides` (single `react-native@0.76.5`);
reconcile native versions with `npx expo install --fix` after checkout.

## Feature framework (P2 + P3)

Features are spec-driven (`src/features/`): a per-feature `FeatureSpec` (input
fields + gate + a **pure request builder** matching the web payload + a result
renderer) runs through one `FeatureRunner` (profile guard → form → gating
pre-check → request → result + interpretation panel). `getFeature(tradition,
slug)` resolves the spec across all traditions.

**28 features across all 6 traditions are live:**
- **Vedic (15):** kundli, dasha, dosha, divisional, kp, matching, horoscope,
  panchang, muhurat, cosmic-calendar, decision-room, numerology×3-modes, mulank,
  tarot, vastu.
- **Western (3):** natal, transits, synastry · **Chinese (3):** bazi, zodiac,
  flying-stars · **Hellenistic (3):** natal (reuses kundli), profections,
  zodiacal-releasing · **Horary (2):** ask + client-side history (MMKV, no API,
  saved via `onSuccess`) · **Medical (2):** decumbiture, body-zodiac.

Request builders and both registries are unit-tested; feature journeys +
tradition switching + horary persistence have Detox specs.

## Rich features (P4)

- **Chat** (`src/chat/`) — streaming replies via `POST /chat/stream` (expo/fetch
  `response.body` + a pure SSE frame parser), with a non-streaming
  `POST /chat/message` fallback; session persistence; category selector.
  Tab + Vedic `chat` feature (custom screen).
- **Reports** (`src/reports/`) — 6 report types; async generate → poll
  `/:id/status` → GET full report; generate + history tabs + reader; 402 = locked.
- **Palmistry** (`src/palmistry/`) — gender + palm photo (camera/gallery via
  `expo-image-picker`) → multipart `POST /palmistry/analyze` → poll → reading.
  Vedic `palmistry` feature (custom). This completes all **17 Vedic** features.
- **Match-share** — a Share action (`FeatureSpec.Extra`) on the matching result
  (`POST …/matching/share` → native share sheet of `{webOrigin}/match/:token`)
  + a public deep-link screen `app/match/[token].tsx` (universal link).
- **Memory** (`src/profile/`) — `/memory` CRUD panel in Profile (the astrologer
  folds these into its prompt server-side).

Pure logic (SSE parser, report-status, palmistry queued/normalizers, share
payload) is unit-tested (58 tests total); Detox specs cover the journeys. Camera
capture + live streaming are verified manually on device.

## Payments (P5) — dual rail

- **Rail B — Play Billing** (`src/payments/`): SKU catalog + pricing parser
  (`products.ts`, pure/unit-tested, same productIds as web), lazy
  `react-native-iap` wrapper (`iap.ts`: buy → `POST /payments/google/verify`
  server-authoritative → finish/consume only after the backend grants; restore
  re-verifies idempotently), and the pricing storefront (`app/pricing`).
  Paywalls are live: PaywallCard → /pricing; Reports/Palmistry locked cards buy
  the exact entitlement SKU inline and auto-retry; chat credit note + profile
  credits link to /pricing.
- **Rail A — consumption**: balances/entitlements bought on the web are read
  via the same `feature-access` results; the "Also available on the web" link
  renders only when `storePolicy.allowWebCheckoutLink === 'true'` (fail-closed
  → India anti-steering compliant).
- Server setup (Play products, service account, RTDN): see
  [`docs/PLAY_BILLING_SETUP.md`](../../docs/PLAY_BILLING_SETUP.md).

## Notifications + performance (P6)

- **Push** (`src/notifications/push.ts`): after sign-in the app registers its
  native FCM token via `POST /users/push-token` (unregistered on logout);
  notification taps deep-link via `data.url`. Server side: `PushService`
  (firebase-admin) + an hourly cron for the daily-briefing nudge, gated by the
  `notification.briefing.push_enabled` SiteSetting (default OFF).
- **Offline**: a connectivity banner (`expo-network`) that also drives TanStack
  Query's `onlineManager` — cached readings stay readable, fetches pause/resume.
- **Performance**: Sentry/query-persistence/notification listeners init AFTER
  first paint (`InteractionManager`); chat renders through FlashList with a
  memoized row; Reassure render-perf tests (`npm run perf`, baseline in
  `.reassure/`, git-ignored); JS bundle budget (`npm run bundle:check`,
  baseline **5.48 MB** Hermes bundle, budget 8 MB) — both wired into mobile CI.

## Auth & account (P1 completion)

- Sign-in screen has three first-party modes — email login, email register
  (server password rules enforced client-side too), and **phone OTP** via the
  backend's own OTP (`/auth/otp/send` + `verify`, auto-creates accounts; the
  dev API returns the code as an on-screen hint) — plus **native Google**
  (`expo-auth-session` ID-token flow → `POST /auth/google`; set
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = the API's `GOOGLE_CLIENT_ID`).
  Auth responses use the NESTED `{ user, tokens: {...} }` shape.
- Profile: referral card (`GET /referral/me`, native share sheet) + the
  self-saving daily-briefing toggle (`GET/PUT /briefing/preferences`).

## Release (P7)

Tag `mobile-vX.Y.Z` → `.github/workflows/mobile-release.yml` builds the
production AAB via EAS and submits to the Play internal track. Detox emulator
job runs on demand (Actions → Mobile CI → Run workflow). Full procedure:
[`docs/mobile/RELEASE_RUNBOOK.md`](../../docs/mobile/RELEASE_RUNBOOK.md).

## Roadmap

~~P2 Vedic features~~ ✓ · ~~P3 Western/Chinese/Hellenistic/Horary/Medical~~ ✓ ·
~~P4 chat/reports/palmistry/match-share~~ ✓ · ~~P5 payments dual-rail~~ ✓ ·
~~P6 notifications + perf~~ ✓ · ~~P7 release pipeline + P1 auth/account~~ ✓ —
**feature-parity v1 complete.** Remaining before store launch: run the Detox
matrix on an emulator, EAS/Play one-time setup, then tag.
