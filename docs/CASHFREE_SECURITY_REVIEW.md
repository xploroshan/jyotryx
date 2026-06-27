# Cashfree Payment Integration — Adversarial Security Review

Scope: the Cashfree payment integration that replaced Razorpay — order creation,
server-side verification, the webhook receiver, refunds, and subscriptions.

Threat model: an attacker who can (a) call our authenticated payment APIs as a
logged-in user, (b) send arbitrary requests to the public webhook endpoint, and
(c) manipulate anything that flows through the browser (amounts, product ids,
the checkout result). They cannot read our server secrets or the database.

Each control below names the file that enforces it and the automated test that
proves it. Backend tests live in `apps/api/test/payment.service.spec.ts` unless
noted; run them with `npm test` (in `apps/api`).

---

## 1. Forged webhook (attacker posts a fake "payment succeeded")

**Attack.** POST a `PAYMENT_SUCCESS_WEBHOOK` (or refund/subscription event) to the
public `/api/payments/webhook` to grant credits / Premium without paying.

**Control.** Every webhook is authenticated with
`base64(HMAC-SHA256(client_secret, x-webhook-timestamp + rawBody))` compared in
**constant time** against the `x-webhook-signature` header
(`cashfree.client.ts:verifyCashfreeSignature` / `safeBase64Equal`,
`payment.service.ts:handleWebhook`). The HMAC is computed over the **raw request
bytes** (`rawBody: true` in `main.ts`), never a re-serialization. With no secret
configured the handler **fails closed** (500), so a misconfigured deploy is not a
free-grant API.

**Proven by:** _rejects a forged signature_, _rejects a signature valid for a
DIFFERENT body (tamper)_, _fails closed when no Cashfree secret is configured_;
plus `security-comprehensive.spec.ts` _rejects a webhook whose signature is for a
different (tampered) payload_.

## 2. Replayed webhook (capture a real event, resend it later)

**Attack.** Replay a previously-valid, correctly-signed webhook to re-trigger a
grant.

**Control.** The timestamp is part of the signed data, so it cannot be altered
without breaking the signature. `handleWebhook` rejects any delivery whose
`x-webhook-timestamp` is outside a ±300s window
(`cashfree.webhookToleranceSeconds`). Even within the window, grants are
idempotent (§4), so a same-window replay grants nothing twice.

**Proven by:** _rejects a replayed webhook whose timestamp is outside the
window_; `security-comprehensive.spec.ts` _rejects a replayed webhook with a
stale timestamp_.

## 3. Amount / price tampering

**Attack.** Create an order for ₹99 but pay ₹1, or POST `create-order` with a
mismatched amount, then verify and collect the full product.

**Controls.**
- **At order creation:** the amount is validated server-side against the
  authoritative price from admin-editable `SiteSettings` (credit packs) or the
  static price map (`payment.service.ts:createOrder` → `resolveCreditPack` /
  `getExpectedPrice`). The granted credit count is captured into
  `Payment.metadata` at this point — never re-derived from a client value later.
- **At verification:** the server fetches the order from Cashfree
  (`GET /pg/orders/{orderId}`), requires `order_status === 'PAID'`, **and
  re-checks `order_amount` against the persisted `Payment.amount`**. A short/over
  payment is rejected (`payment.service.ts:verifyPayment`).
- The client never sends an amount at verify time — only the `orderId`.

**Proven by:** _REJECTS when Cashfree settled a DIFFERENT amount than persisted
(tamper)_, _does NOT grant when the order is not PAID yet_, _rejects an amount
that does not match the pack price (in rupees)_; `security-comprehensive.spec.ts`
amount-validation suite; frontend `checkout.test.tsx` _sends the amount in RUPEES
and verifies with only the orderId_.

## 4. Idempotency / double-grant race

**Attack.** Fire the client `verify` and the `PAYMENT_SUCCESS_WEBHOOK`
concurrently (or replay either) to be credited twice for one payment.

**Control.** The grant runs inside a single `$transaction`, claimed with a
status-guarded `updateMany` (`WHERE gatewayOrderId = ? AND status != 'SUCCESS'`).
Only the caller that actually transitions the row performs the grant; the loser
sees `count === 0` and does nothing. `gatewayOrderId` / `gatewayPaymentId` are
unique, and one-time entitlements are unique per `paymentId`. The same guard
protects `payment.failed` (only still-pending rows may go FAILED) and refunds.

**Proven by:** _grants credits exactly once when the row transitions_, _does NOT
double-grant when the row was already claimed (race loser)_, _is idempotent — a
second verify on an already-claimed order grants nothing_.

## 5. Refund leak (buy → refund → keep the goods)

**Attack.** Buy credits or a report, get refunded, but keep the credits /
entitlement.

**Control.** On `REFUND_STATUS_WEBHOOK` (status SUCCESS) the payment is marked
REFUNDED and, atomically: for credit purchases the granted credits are clawed
back **clamped at the current balance** (wallet never goes negative); for
one-time unlocks the entitlement is voided
(`payment.service.ts:handleRefund` → `featureAccess.voidEntitlementByPayment`).
Idempotent via the status guard.

**Proven by:** _marks REFUNDED and claws back granted credits (clamped at
balance)_, _voids the entitlement (not credits) when refunding a one-time
unlock_, _is idempotent — a redelivered refund that claims nothing reverses
nothing_, _ignores a non-SUCCESS refund status_.

## 6. Subscription abuse (free Premium)

**Attack.** Open the subscription authorization then abandon it, or downgrade,
yet keep Premium.

**Controls.** Premium is **never** granted at subscription creation — only on the
`SUBSCRIPTION_STATUS_CHANGE` (ACTIVE) / successful-charge webhook
(`activateSubscription`). Terminal/paused states (CANCELLED/COMPLETED/EXPIRED/ON
HOLD/PAUSED) revoke Premium, but only if the user has no other active
subscription (`revokePremiumIfNoActiveSub`). The client cannot pick an arbitrary
plan — it sends a logical tier (MONTHLY/ANNUAL) that the server maps to a
configured Cashfree `plan_id`; a live deploy with no plan configured fails
closed. A second active subscription cannot be minted while one is live.

**Proven by:** _grants PREMIUM when a subscription becomes ACTIVE_, _grants
PREMIUM on a successful subscription charge event_, _revokes PREMIUM on CANCELLED
when no other active subscription remains_, _keeps PREMIUM on cancel when another
active subscription remains_, _fails closed when live but no plan_id is
configured_, _refuses to mint a second subscription when one is already active_.

## 7. Authn / authz bypass

**Attack.** Call payment APIs unauthenticated, or act on another user's order.

**Control.** A global `JwtAuthGuard` protects every route; only `pricing` and
`webhook` are `@Public()`. `create-order`, `verify`, `subscribe`, and `history`
all scope to `user.sub` from the JWT, and `verify` requires the order to belong
to the calling user.

**Proven by:** _rejects an order that does not belong to the user_ (unit +
`e2e.spec.ts` _rejects verification for an order not owned by the user_); guard
wiring in `payment.controller.ts` / `app.module.ts`.

## 8. Secret handling

- The Cashfree **client secret is server-only**; the browser receives only the
  public `mode` (`NEXT_PUBLIC_CASHFREE_MODE`) and a per-order
  `payment_session_id` / subscription session.
- No secrets are committed (`.env.example` and `k8s/base/secrets.yaml` carry
  placeholders only).
- API errors from Cashfree are logged server-side but surfaced to clients as a
  generic 500 (`cashfree.client.ts:CashfreeApiError` handling), so gateway
  internals are not leaked.

---

## Residual risk / operational notes

- **Webhook timestamp format / signing key.** Verified against Cashfree's
  documented scheme (base64 HMAC over `timestamp + rawBody`, signed with the
  client secret). Confirm in the Cashfree dashboard whether a *separate* webhook
  secret is configured; if so set `CASHFREE_WEBHOOK_SECRET` (the code falls back
  to the client secret otherwise). Validate end-to-end in sandbox.
- **Subscription event names.** The handler activates Premium on
  `SUBSCRIPTION_STATUS_CHANGE` (ACTIVE) and on any subscription event carrying a
  successful payment status, so it is tolerant of the exact charge-event name —
  but confirm the recurring-charge event in sandbox before launch.
- **`notify_url` must be public HTTPS** in production (`API_PUBLIC_URL`).
- The webhook remains the **authoritative** settlement path; client `verify` is a
  fast-path confirmation and is safe to call repeatedly (idempotent).
- **Manual verification:** drive a sandbox payment (test UPI `success@upi` /
  `failure@upi`, test cards) with `notify_url` tunnelled to
  `/api/payments/webhook`; confirm PAID → credits, refund → clawback, and a UPI
  AutoPay mandate → Premium.
