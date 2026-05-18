# myastro360 — E2E Test Plan

This is the contract for what the Playwright suite covers, what it deliberately doesn't, and what you need to validate on a real deployment before declaring a release safe to ship.

The suite is **hermetic** — `apps/web/playwright.config.ts` boots a real Next.js dev server but mocks every `**/api/**` request through `apps/web/e2e/helpers/mock-api.ts`. No live backend is required.

## How to run

```bash
cd apps/web
npx playwright install chromium   # first time only
npx playwright test                # full suite

# or a single spec
npx playwright test auth.spec.ts --reporter=list

# or a filtered subset
npx playwright test --grep "change password"
```

In CI the suite runs as the `e2e-web` job in `.github/workflows/ci.yml`.

## Coverage matrix

### Authentication

| Flow | Spec | What it asserts |
|------|------|-----------------|
| Phone OTP signup | `auth.spec.ts` | Send → verify → redirect to `/profile?complete=1` |
| Invalid OTP | `auth.spec.ts` | Error renders, user stays on `/auth` |
| Toggle phone/email method | `auth.spec.ts` | Switching surfaces the correct fields |
| Signup tab — name field appears | `auth.spec.ts` | Both phone and email methods show `Enter your name` |
| Email/password login (happy path) | `auth.spec.ts` | `POST /auth/login` → redirect to `/my-day` |
| Email/password login (401) | `auth.spec.ts` | Error banner shown, user stays on `/auth` |
| Email/password login (network error) | `auth.spec.ts` | Generic banner + Retry button |

### Session persistence ("remember me")

| Flow | Spec | What it asserts |
|------|------|-----------------|
| Hard refresh on protected page keeps the user | `auth-persistence.spec.ts` | `/my-day` does not bounce to `/auth` after reload |
| Cross-page navigation keeps the session | `auth-persistence.spec.ts` | `/my-day → /reports → /profile → /my-day` without re-auth |
| Unauth visitor still bounced | `auth-persistence.spec.ts` | `/my-day` without state → `/auth` |

Auth state is persisted to `localStorage` as `myastro360-auth` (Zustand `persist` middleware). The regression these tests guard is the hydration race where `isAuthenticated` was synchronously read before the persisted store had rehydrated, causing every page reload to log the user out.

### Password change (signed-in user) — `change-password.spec.ts` (new)

| Flow | What it asserts |
|------|-----------------|
| Happy path | `POST /auth/change-password` called with `{currentPassword, newPassword}`; form clears |
| Short new password | Submit blocked; no API call |
| Mismatch new vs confirm | Submit blocked; no API call |
| Wrong current password (backend 401) | Error message rendered |
| Set-password for OAuth/OTP-only user | No current-password field; calls `POST /auth/set-password` instead |

### Password reset (forgot password) — `reset-password.spec.ts` (new)

Firebase is intentionally disabled in the test rig (`NEXT_PUBLIC_FIREBASE_API_KEY=''`) because the auth-page tests rely on the backend OTP fallback path. As a result, the reset flow's Firebase verification always fails in this rig, which is exactly the production "invalid link" branch. These tests assert the invalid-link UX precisely:

| Flow | What it asserts |
|------|-----------------|
| No `oobCode` | Invalid-link UI |
| Wrong `mode` parameter | Invalid-link UI |
| Firebase rejects code | Invalid-link UI |
| "Back to login" link | Navigates to `/auth` |

**The happy path (valid code → form → success → redirect) must be validated against real Firebase** — see "Live deployment smoke" below.

### Admin panel — `admin.spec.ts`, `admin-funnel.spec.ts`, `admin-ops.spec.ts`, `admin-safety.spec.ts`

Every tab and every drilldown.

| Tab | Coverage |
|-----|----------|
| Auth gating | Unauthenticated → `/auth`; non-admin role → `/auth`; admin role lands on dashboard |
| Dashboard | KPI cards render from `/admin/dashboard`; MRR/ARR/ARPU/LTV growth tiles; stuck-onboarding section |
| Users | Table loads; drilldown opens detail panel; edit modal saves credits; quick role change |
| Activity | Logs render |
| Payments | Table loads |
| Chats | Table loads |
| Analytics | Charts render |
| Pricing | Inputs prefill, save merges payload to `PUT /admin/settings` |
| **AI Agents (LLM)** | Provider list loads from `/admin/settings?prefix=llm.`; disable/enable POSTs to `/admin/llm/provider/:name/:action` |
| Content | Knowledge-base counts render |
| Funnel | Funnel chart, cohort grid, payment-failure rows; locale change recomputes counts |
| Ops | Service health, queues, error rate, latency, capacity; provider disable click |
| Safety | Pending flagged messages list; resolve via Hide / Approve / Actioned; success toast |
| GDPR | Pending requests with metadata |
| Cost | MTD spend, daily sparkline, top features and providers; thresholds save to `notification.cost.*` |
| Error resilience | Every tab surfaces fetch failures with a visible error and retry; malformed responses don't crash the page |

### AI components — `chat-stream.spec.ts`

| Flow | What it asserts |
|------|-----------------|
| Chat page loads | Message input is visible |
| Existing sessions render | Past sessions appear from `/chat/sessions` |
| Reports page lists user reports | `/reports` renders the BullMQ-generated report list |
| Palmistry upload area | `/palmistry` mounts with the upload affordance (R2 path) |

### Feature pages

Each tradition / feature has a smoke spec asserting the page mounts, renders its primary affordance, and has no JS errors.

| Spec | Page |
|------|------|
| `kundli.spec.ts` | `/kundli` + `/kundli/[city]` |
| `panchang.spec.ts` | `/panchang` + `/panchang/[city]` |
| `horoscope.spec.ts` | `/horoscope/[sign]` |
| `matching.spec.ts` | `/matching` |
| `numerology.spec.ts` | `/numerology` |
| `palmistry.spec.ts` | `/palmistry` |
| `tarot.spec.ts` | `/tarot` |
| `vastu.spec.ts` | `/vastu` |
| `muhurat.spec.ts` | `/muhurat` |
| `pricing.spec.ts` | `/pricing` |
| `profile.spec.ts` | `/profile` |
| `my-day.spec.ts` | `/my-day` daily briefing |
| `divisional.spec.ts` | `/divisional` |
| `kp-astrology.spec.ts` | `/kp-astrology` |
| `astrology-traditions.spec.ts` | Tradition switcher in nav |
| `reports.spec.ts` | `/reports` |

### Cross-cutting

| Spec | Asserts |
|------|---------|
| `accessibility.spec.ts` | `@axe-core/playwright` scan on core pages — no critical violations |
| `route-focus.spec.ts` | `RouteFocusReset` moves focus to `<main>` on every navigation |
| `navigation.spec.ts` | Nav links resolve, no dead routes |
| `i18n.spec.ts` | Locale switch persists and re-renders nav strings |
| `i18n-briefing.spec.ts` | `/my-day` briefing renders in the active locale |

## What the suite intentionally does NOT cover

| Gap | Why | Where to validate |
|-----|-----|---------------------|
| Real Firebase phone OTP delivery | SMS quota costs money; flaky in headless | Live smoke on staging — receive a real OTP |
| Real Firebase password reset email | Same — requires Firebase Email Action URL + real inbox | Live smoke — request reset, click email link, set new password |
| Real Razorpay payment | PCI scope, test mode varies | Razorpay test-mode buyer flow on staging |
| Real LLM provider responses | Cost, latency, nondeterminism | Smoke a kundli + chat against staging API |
| Real R2 upload | Requires R2 creds | Upload a palmistry image on staging |
| Real Postgres transaction integrity | Hermetic mocks return canned JSON | Integration tests in `apps/api/test/` (run separately) |
| Real Sentry / OTEL ingestion | External services | Verify by deploying and tripping an error |
| Real Cloudflare Tunnel / DNS / TLS | External infrastructure | Use the live-smoke checklist below after DNS cutover |

## Live deployment smoke checklist

After any deploy that touches DNS, auth, or payments, run through these in a fresh incognito window on `https://www.myastro360.com`:

1. **Signup (phone OTP)** — Enter phone, receive SMS, enter OTP, land on `/profile?complete=1`. Fill profile, reach `/my-day`.
2. **Signup (email)** — Same flow with email + password. Receive welcome email if configured.
3. **Login (email)** — Sign out, sign back in with the credentials from step 2. Land on `/my-day` with credits visible.
4. **Login persistence** — Hard refresh `/my-day`. Should NOT bounce to `/auth`. Close tab, reopen `myastro360.com`. Should NOT require re-login.
5. **Change password** — On `/profile → Security`, type current + new + confirm, submit. Sign out, sign back in with new password.
6. **Forgot password** — On `/auth`, click "Forgot password?". Receive email. Click link → lands on `/reset-password?mode=resetPassword&oobCode=...`. Verifies email shown, set new password, redirected to `/auth?mode=login`. Sign in with new password.
7. **Generate kundli** — Fill birth details, submit, see full reading tabs (Birth Chart, Houses, Dashas, Yogas, Doshas). Confirm planet positions look plausible for the chosen date.
8. **Chat with AI** — Open `/chat`, pick a category, send a message. Confirm reply renders, credits decremented, locale honored if you switch language first.
9. **Buy credits** — `/pricing`, choose smallest pack, complete a Razorpay test-mode payment. Credits update in the navbar.
10. **Admin** — Sign in as the bootstrap admin. Open `/admin`. Every tab loads. Toggle an LLM provider off; confirm Ops tab reflects the kill-switch. Toggle it back on.
11. **Daily briefing email** — Manually trigger `/admin/ops/briefing/run-now` (or wait for the cron). Confirm receipt at your test inbox, branded as myastro360 with the correct unsubscribe link.

## Maintenance notes for future authors

- **Hermeticity is the contract.** Don't reach the real backend from an E2E. Add a handler to the `installApiMocks` map instead. Unhandled calls fail loud with a `[mock-api] Unhandled` log so the missing handler is obvious.
- **Selectors should be role-based.** `getByRole('button', { name: 'X' })` is more robust than `.locator('.some-class')`. The recent role="tab" change on the auth page is a reminder — the suite was updated to match.
- **The auth-page method toggle uses `role="tab"`** (not `button`), because it's wrapped in a `role="tablist"`. Same for login/signup tabs.
- **The reset-password Firebase happy path is not tested here.** If you change that page's Firebase usage, also smoke-test against real Firebase before merging.
- **Dev-mode hydration race**: `gotoAndHydrate()` waits for React to attach handlers. For the first click on a specific component, also call `waitForReactHandlers({ role, name })`. The race is dev-only — production `next start` doesn't need it.
