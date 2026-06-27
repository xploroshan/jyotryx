# Payments (Cashfree) — setup & operations

myastro360 monetizes via **one‑time credit packs** and a **recurring Premium**
subscription, both through **Cashfree** — the right gateway for an India‑first,
**UPI**‑centric product (first‑class UPI intent/collect/QR, plus **UPI AutoPay**
mandates for recurring billing, which Stripe doesn't offer in India).

Cashfree is the **single gateway** (API version **2025-01-01**). Base URLs:

- Sandbox: `https://sandbox.cashfree.com/pg`
- Production: `https://api.cashfree.com/pg`

The integration is built end‑to‑end:

- **API** `apps/api/src/modules/payment/` — `create-order` → `verify` for
  credit packs; `subscribe` (server‑mapped plan IDs) for Premium;
  signature‑verified `webhook`. Idempotent, status‑guarded credit grants and
  role changes.
- **Web** `apps/web/src/app/checkout` and `/pricing` — drive **cashfree.js v3**
  (`checkout({ paymentSessionId })` for one‑time orders, subscription checkout
  for mandates).

---

## 1. Environment variables

**API** (`apps/api`):

| Var | Purpose |
| --- | --- |
| `CASHFREE_CLIENT_ID` | App ID (client id) |
| `CASHFREE_CLIENT_SECRET` | Secret key (server‑only) |
| `CASHFREE_WEBHOOK_SECRET` | Webhook signing secret — **optional**, falls back to `CASHFREE_CLIENT_SECRET` when blank |
| `CASHFREE_ENV` | `sandbox` or `production` — selects the base URL |
| `CASHFREE_API_VERSION` | `2025-01-01` (sent as the `x-api-version` header) |
| `CASHFREE_PLAN_MONTHLY` | Cashfree **plan_id** for monthly Premium |
| `CASHFREE_PLAN_ANNUAL` | Cashfree **plan_id** for annual Premium |
| `API_PUBLIC_URL` | Public, internet‑reachable base URL of this API (incl. `/api`), used to build the webhook `notify_url`. **HTTPS in production.** |

**Web** (`apps/web`):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CASHFREE_MODE` | `sandbox` or `production` — the only Cashfree value exposed to the browser. **Never** expose the client secret. |

## 2. Cashfree dashboard setup

1. **Create account → complete KYC/activation** (business docs) for production.
2. **Payment Methods**: enable **UPI** and **UPI AutoPay** (plus cards /
   netbanking / wallets) for one‑time and recurring flows.
3. **Subscriptions → Plans**: create the monthly and annual plans and copy their
   `plan_id`s into `CASHFREE_PLAN_MONTHLY` / `CASHFREE_PLAN_ANNUAL`.
4. **Webhooks**: add `${API_PUBLIC_URL}/payments/webhook`, set the signing secret
   to match `CASHFREE_WEBHOOK_SECRET` (or leave it as the client secret), and
   subscribe to:
   - `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`,
     `PAYMENT_USER_DROPPED_WEBHOOK`
   - `REFUND_STATUS_WEBHOOK`
   - `SUBSCRIPTION_STATUS_CHANGE` and the subscription charge/auth events

## 3. One‑time flow (credit packs)

Amounts are handled in **INR rupees**, not paise.

1. **`POST /api/payments/create-order`** → `{ orderId, paymentSessionId, amount
   (rupees), currency }`.
2. The web opens **cashfree.js v3** `checkout({ paymentSessionId })` — UPI intent
   (GPay/PhonePe/Paytm on mobile), UPI collect, and UPI QR (desktop) plus cards
   and netbanking surface automatically.
3. **`POST /api/payments/verify { orderId }`** — the server fetches **`GET
   /pg/orders/{orderId}`**, requires `order_status === 'PAID'`, **re‑checks the
   amount**, then grants the pack's credits (or a one‑time entitlement)
   **exactly once** — status‑guarded and idempotent, so duplicate verifies and
   the webhook can't double‑grant.

## 4. Webhook

**`POST /api/payments/webhook`** (public). For each request the server verifies:

- **Signature** — header `x-webhook-signature` must equal
  `base64(HMAC-SHA256(client_secret, x-webhook-timestamp + rawBody))`, computed
  over the **raw** request body together with the `x-webhook-timestamp` header.
- **Replay window** — `x-webhook-timestamp` must be within **±300s** of now.

Event types handled:

| Event | Effect |
| --- | --- |
| `PAYMENT_SUCCESS_WEBHOOK` | Marks the order PAID **once** (atomic status‑guard) and grants credits / entitlement exactly once |
| `PAYMENT_FAILED_WEBHOOK` | Order → FAILED |
| `PAYMENT_USER_DROPPED_WEBHOOK` | Order → FAILED / abandoned (user dropped before paying) |
| `REFUND_STATUS_WEBHOOK` | Confirms a refund (see §6) |
| `SUBSCRIPTION_STATUS_CHANGE` + subscription charge/auth events | Drive the subscription lifecycle (see §5) |

## 5. Subscriptions (Premium)

1. **`POST /pg/subscriptions`** with a configured `plan_id`
   (`CASHFREE_PLAN_MONTHLY` / `CASHFREE_PLAN_ANNUAL`).
2. The user authorizes a **UPI AutoPay / eNACH / card** mandate via the
   cashfree.js **subscription checkout**.
3. **PREMIUM is granted on the `ACTIVE` status / first successful charge
   webhook — not on creation.** This avoids granting access for an
   authorization that never charges.
4. **Cancel / expire** revokes PREMIUM **unless** the user still has another
   active subscription.

Premium access is gated by **`user.role`**. ADMIN accounts are never downgraded
(revoke is guarded by `role: 'PREMIUM'`). Admin manual cancellation (`/admin`)
applies the same revoke.

## 6. Refunds

- Initiate via **`POST /pg/orders/{orderId}/refunds`**.
- Confirmed asynchronously by **`REFUND_STATUS_WEBHOOK`**.
- On confirmation: **credit clawback** (clamped at the current balance) for
  credit‑pack purchases, or **entitlement void** for one‑time entitlements.
- **Idempotent** — a re‑delivered refund webhook does not double‑claw.

## 7. Data model

Payment/subscription rows use **provider‑neutral** columns so the gateway can be
swapped without a schema rewrite:

| Column | Meaning |
| --- | --- |
| `payments.gatewayOrderId` | Cashfree `order_id` |
| `payments.gatewayPaymentId` | Cashfree payment id |
| `payments.provider` | Gateway identifier (`cashfree`) |
| `subscriptions.gatewaySubscriptionId` | Cashfree subscription id |
| `subscriptions.provider` | Gateway identifier (`cashfree`) |

Legacy Razorpay rows are **backfilled to `provider = 'razorpay'`** so historical
records remain attributable to their original gateway.

## 8. Test mode → live

- Use **sandbox** credentials (`CASHFREE_ENV=sandbox`) and pay with Cashfree's
  test UPI / test cards.
- Verify: credits land once; Premium grants only after the `ACTIVE` / first
  charge webhook; cancelling revokes Premium; a refund claws back credits.
- Unit coverage: `apps/api/test/payment.service.spec.ts` (idempotency +
  full subscription lifecycle + refund clawback).
- Switch to **production** (`CASHFREE_ENV=production`) with live credentials,
  live `plan_id`s, and the live webhook, and confirm KYC is activated and
  `API_PUBLIC_URL` resolves over HTTPS.
