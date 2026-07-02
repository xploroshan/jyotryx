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
# from the repo root
npm install
cd apps/mobile
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

`@myastro360/mobile` is an npm workspace, so a root `npm ci` now also installs
the React Native/Expo tree. The existing web/api CI jobs (`.github/workflows/ci.yml`)
are unaffected in behaviour but will install more packages; mobile has its own
pipeline in `.github/workflows/mobile-ci.yml`. Native versions should be
reconciled with `npx expo install --fix` after checkout.

## Roadmap

P2 Vedic features · P3 other 4 traditions · P4 chat/reports/palmistry/match-share ·
P5 payments dual-rail · P6 notifications + perf · P7 full Detox suite + Play release.
