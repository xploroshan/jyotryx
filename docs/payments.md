# Payments (Razorpay) — setup & operations

myastro360 monetizes via **one‑time credit packs** and a **recurring Premium**
subscription, both through **Razorpay** — the right gateway for an India‑first,
**UPI**‑centric product (first‑class UPI intent/collect/QR, plus **UPI Autopay**
e‑mandates for recurring billing, which Stripe doesn't offer in India).

The integration is already built end‑to‑end:

- **API** `apps/api/src/modules/payment/` — `create-order` → `verify`
  (constant‑time HMAC) for credit packs; `subscribe` (server‑mapped plan IDs)
  for Premium; signature‑verified `webhook`. Idempotent credit grants and role
  changes. Falls back to **mock mode** when keys are absent (local dev works
  with no real keys).
- **Web** `apps/web/src/app/checkout` (Checkout.js modal for packs) and
  `/pricing` (Razorpay hosted page for subscriptions).

---

## 1. Environment variables

**API** (`apps/api`):

| Var | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID` | API key id |
| `RAZORPAY_KEY_SECRET` | API key secret (server‑only) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing secret |
| `RAZORPAY_PLAN_MONTHLY` | Razorpay **Plan** id for ₹499/mo Premium |
| `RAZORPAY_PLAN_ANNUAL` | Razorpay **Plan** id for ₹4999/yr Premium |

**Web** (`apps/web`):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public key id for Checkout.js (same id as `RAZORPAY_KEY_ID`) |

> Without `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` the API runs in **mock mode**
> (no real charges; subscriptions grant Premium immediately for local dev).

## 2. Razorpay dashboard setup

1. **Create account → complete KYC/activation** (business docs) for live mode.
2. **Settings → Payment Methods**: enable **UPI** and **UPI Autopay**, plus
   cards / netbanking / wallets.
3. **Subscriptions → Plans**: create two plans (Monthly ₹499, Annual ₹4999) and
   copy their ids into `RAZORPAY_PLAN_MONTHLY` / `RAZORPAY_PLAN_ANNUAL`.
4. **Settings → Webhooks**: add `https://<api-host>/payments/webhook`, set the
   secret to match `RAZORPAY_WEBHOOK_SECRET`, and subscribe to:
   - `payment.captured`, `payment.failed`
   - `subscription.activated`, `subscription.charged`
   - `subscription.cancelled`, `subscription.halted`, `subscription.completed`
   - `refund.created`, `refund.processed`

## 3. How UPI works here

- **Credit packs (one‑time):** Checkout.js shows UPI intent (GPay/PhonePe/Paytm
  on mobile), UPI collect, and UPI QR (desktop) automatically — no extra code.
- **Premium (recurring):** UPI Autopay mandate via the hosted subscription page.
  ₹499/mo and ₹4999/yr are both under the ₹15,000 UPI‑Autopay per‑debit limit,
  so no step‑up auth is needed.

## 4. Lifecycle (what each event does)

| Event | Effect |
| --- | --- |
| `verify` / `payment.captured` | Marks the order SUCCESS **once** (atomic status‑guard) and grants the pack's credits exactly once |
| `payment.failed` | Order → FAILED |
| `subscription.activated` / `charged` | Subscription → ACTIVE, `endDate` rolled to the new period, user role → **PREMIUM** |
| `subscription.cancelled` | Subscription → CANCELLED, role → USER (unless another active sub) |
| `subscription.halted` / `completed` | Subscription → EXPIRED, role → USER (unless another active sub) |
| `refund.created` / `refund.processed` | Payment → REFUNDED (atomic status‑guard); for credit purchases, claws back the granted credits (clamped at the current balance) and logs a negative‑amount `PURCHASE` ledger entry |

Premium access is gated by **`user.role`**. ADMIN accounts are never downgraded
(the revoke is guarded by `role: 'PREMIUM'`). Admin manual cancellation
(`/admin`) applies the same revoke.

## 5. Test mode → live

- Use **test** keys; pay with test UPI `success@razorpay` (or test cards).
- Verify: credits land once; Premium grants only after `subscription.charged`;
  cancelling revokes Premium.
- Unit coverage: `apps/api/test/payment.service.spec.ts` (idempotency +
  full subscription lifecycle + refund clawback).
- Swap in **live** keys + live Plan ids + the live webhook, and confirm KYC is
  activated.

## 6. Known follow‑ups

- **Refunds** reverse credits for credit‑pack purchases. They do **not** yet
  auto‑revoke Premium on a refunded subscription charge — refund a recurring
  charge and then cancel the subscription (or revoke the role via `/admin`) if
  the user should lose access immediately.
- The clawback logs a signed `PURCHASE` ledger entry because
  `CreditTransactionType` has no dedicated `REFUND` value. Add one (a schema
  migration) if refund reporting needs to distinguish reversals from purchases.
- Subscriptions use a finite `total_count` (12 monthly / 5 annual); the
  `completed` handler now revokes Premium, but consider a longer count or
  auto‑renew strategy for true open‑ended billing.
