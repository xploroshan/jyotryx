# Cashfree — Sandbox (Test Mode) Setup

The payment integration (Cashfree) is code-complete. This is the runbook to run it
in **sandbox/test mode** end-to-end. Until real sandbox credentials are set the API
runs in **mock mode** (synthetic payment sessions), so local dev works with no
Cashfree account.

Sandbox API base: `https://sandbox.cashfree.com/pg` · Web SDK: Cashfree JS v3 (CDN).

## 1. Get sandbox credentials
Cashfree dashboard (sandbox) → Developers → API Keys → copy the **App ID** and
**Secret Key**.

## 2. Create the subscription plans (only needed to test subscriptions)
Dashboard → Subscriptions → create two recurring plans **at the price you want to
charge** — for subscriptions the *plan's* amount is authoritative; the app only sends
`plan_id`. Keep them in sync with the display prices `pricing.monthly.price` /
`pricing.annual.price` (seeded ₹99 / ₹2999). Copy each returned `plan_id`.

> One-time orders and the ₹100 overage packs (`overage_chat`, `overage_palmistry`)
> do **not** need a plan — they settle through `create-order` → `verify`/webhook.

## 3. Register the webhook
Dashboard → Webhooks → add `https://<public-api-host>/api/payments/webhook` and
subscribe to: `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`,
`REFUND_STATUS_WEBHOOK`, `SUBSCRIPTION_STATUS_CHANGE`, and all `SUBSCRIPTION_*`
events. If the dashboard issues a separate webhook secret, set
`CASHFREE_WEBHOOK_SECRET`; otherwise it falls back to `CASHFREE_CLIENT_SECRET`.

> **Webhooks need a public HTTPS URL.** Localhost can't receive them. Use a deployed
> staging host, or tunnel local dev (the repo ships `cloudflare-tunnel.yml`).
> One-time orders still settle via the synchronous `verify` path without webhooks,
> but **subscription activation requires the `SUBSCRIPTION_STATUS_CHANGE` webhook.**

## 4. Environment variables
**API (`apps/api/.env`)**
```
CASHFREE_CLIENT_ID=<sandbox app id>
CASHFREE_CLIENT_SECRET=<sandbox secret>
CASHFREE_ENV=sandbox
CASHFREE_API_VERSION=2025-01-01
CASHFREE_PLAN_MONTHLY=<plan_id>        # only for subscriptions
CASHFREE_PLAN_ANNUAL=<plan_id>         # only for subscriptions
CASHFREE_WEBHOOK_SECRET=               # only if dashboard issues a separate secret
API_PUBLIC_URL=https://<public-api-host>/api   # builds the webhook notify_url
FRONTEND_URL=https://<web-host>                # builds the checkout return_url
```
**Web (`apps/web/.env`)**
```
NEXT_PUBLIC_API_URL=https://<public-api-host>/api
NEXT_PUBLIC_CASHFREE_MODE=sandbox
```
The API logs clear warnings at boot if credentials are set but the plan IDs or
`API_PUBLIC_URL` are missing.

## 5. Turn the model on (Admin → Monetization, or the `site_settings` table)
- `feature.subscriptions_enabled = true` — active subscribers bypass per-use payment.
- `feature.pricing_page_enabled = true` — shows plans/checkout instead of the free banner.
- `feature.credits_enabled = false` — runs the new subscription model (free/limits/overage)
  instead of the legacy credit currency. (Leave `true` to keep credits.)

Limits and overage pack prices are already seeded (`limits.*`,
`pricing.credits.overage_*`) and tunable on the same admin tab.

## 6. Verify
1. **Mock check (no creds):** flags on → `/pricing` renders plans;
   `/checkout?type=credits&pack=overage_chat` resolves ₹100. Proves wiring.
2. **One-time / overage:** real sandbox → buy an overage pack with a Cashfree test
   instrument → `verify` grants the bonus (`addUsageBonus`) → the feature's allowance rises.
3. **Subscription:** Subscribe → `subscriptionsCheckout` mandate → on the
   `SUBSCRIPTION_STATUS_CHANGE=ACTIVE` webhook the user becomes PREMIUM →
   deep-dive/chat unlocked (`isActiveSubscriber`).
4. **Negative paths:** a tampered amount → `verify` 402 mismatch; a replayed/forged
   webhook → rejected (signature/timestamp).

Use Cashfree's documented sandbox **test UPI VPA / test cards** for instruments.

## Known gaps (acceptable in test; address before public launch)
- No self-serve **subscription-cancel UI** (cancel from the dashboard works; the
  webhook revokes PREMIUM).
- **Zombie PENDING** subscriptions if a mandate is abandoned (low impact).
- ₹99→₹299 **auto-step intro** is deferred — sandbox uses the flat seeded price.
