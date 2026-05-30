# Full-stack real-API E2E

These Playwright specs drive the **entire stack with no mocks**:

```
real Chromium → real Next.js (3110) → real NestJS API (4110)
              → real Postgres + Redis (ephemeral, booted per run)
```

Contrast with `../e2e/` (the default `npm run test:e2e`), which mocks every
`**/api/**` call and is hermetic. This suite exists to catch the class of bug
that only shows up across the real frontend↔backend contract — e.g. the
duplicate-account-on-OTP-login regression and the report
generate→view→download flow.

## Run it

```bash
# from apps/web
npm run test:e2e:realapi
```

`global-setup.ts` boots Redis + Postgres (reusing the API integration suite's
`test/integration/infra/*` daemon launchers), migrates + seeds, builds the API
if `apps/api/dist/main.js` is missing, and starts it on `E2E_API_PORT` (4110).
Playwright's `webServer` then boots the Next.js dev server pointed at it.
`global-teardown.ts` tears all of it down.

## What runs in "fallback" mode

External services have no credentials in CI/sandbox, so the app's built-in
fallbacks engage — which is the point: we test *our* code, not third parties.

| Service   | Behaviour in this suite                                              |
|-----------|---------------------------------------------------------------------|
| Firebase  | backend OTP path; `OTP_EXPOSE_IN_RESPONSE=true` returns `devOtp`     |
| OpenAI    | reports use the KB/template fallback (`QUEUE_ENABLED=false` → sync)  |
| Razorpay  | not exercised (no real payments)                                    |
| Throttler | disabled via `THROTTLE_DISABLED=true` so repeated OTP sends don't 429 |

## Env knobs

| Var                     | Default | Purpose                                     |
|-------------------------|---------|---------------------------------------------|
| `E2E_API_PORT`          | `4110`  | port the real API listens on                |
| `E2E_WEB_PORT`          | `3110`  | port the web dev server listens on          |
| `E2E_FORCE_API_BUILD`   | —       | `true` forces a `nest build` in global-setup |
| `PLAYWRIGHT_CHROME_PATH`| —       | override the Chromium binary path           |
