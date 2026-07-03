# Google Play Billing — Setup Runbook

Step-by-step setup for the mobile payments rail (P5). The backend endpoints
(`POST /payments/google/verify`, `POST /payments/google/rtdn`) are live in the
API; this runbook wires the Google side. Do it once, in order.

## 1. Play Console — create the products

In [Play Console](https://play.google.com/console) → your app
(`com.myastro360.app`) → **Monetize**:

**In-app products** (Products → In-app products → Create). Product IDs must be
EXACTLY these (they match the web productIds; the backend resolves them with
the same logic):

| Product ID | Name | Suggested price* |
|---|---|---|
| `credits_starter` | 50 credits | ₹99 |
| `credits_popular` | 150 credits | ₹249 |
| `credits_pro` | 500 credits | ₹699 |
| `report_life` | Life report | ₹199 |
| `report_career` | Career report | ₹199 |
| `report_marriage` | Marriage report | ₹199 |
| `report_wealth` | Wealth report | ₹199 |
| `report_annual` | Annual report | ₹199 |
| `report_palm` | Palm report | ₹199 |
| `palm_reading` | Palmistry reading | ₹250 |

\* Play prices are what the customer pays; the credits/entitlement granted are
defined by SiteSettings (`pricing.credits.*` etc.) — keep them consistent.

**Subscriptions** (Products → Subscriptions → Create):

| Product ID | Base plan | Suggested price |
|---|---|---|
| `premium_monthly` | monthly auto-renewing | ₹499/month |
| `premium_annual` | annual auto-renewing | ₹4999/year |

Activate every product after creating it.

## 2. Service account (for server-side verification)

1. Google Cloud Console → IAM & Admin → **Service Accounts** → Create
   (`play-billing-verifier`). No GCP roles needed.
2. Keys → Add key → **JSON** → download.
3. Play Console → **Users and permissions** → Invite user → the service
   account's email → App permissions: your app → grant **View financial data**
   and **Manage orders and subscriptions**.
4. Collapse the JSON to a single line and set it on Railway (API service):

```bash
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='{"type":"service_account","client_email":"play-billing-verifier@…","private_key":"-----BEGIN PRIVATE KEY-----\n…"}'
GOOGLE_PLAY_PACKAGE_NAME=com.myastro360.app
```

Without these the API runs in mock mode (dev) and **fails closed in
production** — no purchase can be spoofed.

## 3. RTDN (Real-time Developer Notifications)

Gives the server renew/cancel/refund events (the Play analogue of the Cashfree
webhook).

1. Google Cloud Console (same project as the service account) → **Pub/Sub** →
   Create topic `play-rtdn`.
2. Create a **push subscription** on that topic. Endpoint:

```
https://api.myastro360.com/api/payments/google/rtdn?token=<LONG_RANDOM_SECRET>
```

   Generate the secret with `openssl rand -hex 32` and set the same value on
   Railway:

```bash
GOOGLE_PLAY_RTDN_TOKEN=<LONG_RANDOM_SECRET>
```

3. Grant the Google Play publisher `google-play-developer-notifications@system.gserviceaccount.com`
   the **Pub/Sub Publisher** role on the topic.
4. Play Console → Monetize → Monetization setup → **Real-time developer
   notifications** → paste the full topic name
   (`projects/<project>/topics/play-rtdn`) → Save → **Send test notification**.
   The API answers 200 and records outcome `ok` (visible in metrics).

The endpoint fails closed when `GOOGLE_PLAY_RTDN_TOKEN` is unset and rejects
wrong tokens with 401 (constant-time compare).

## 4. Store policy (anti-steering)

Admin-tunable via SiteSettings — defaults are India-safe (web link hidden):

| Key | Default | Meaning |
|---|---|---|
| `store.region_mode` | `IN` | Reported to the app as `storePolicy.region` |
| `store.allow_web_checkout_link` | `false` | `true` shows "Also available on myastro360.com" in the app's pricing screen. **Keep `false` for India distribution.** |

## 5. Sandbox testing (internal test track)

1. Play Console → Testing → **Internal testing** → create a release with the
   EAS AAB (`eas build -p android --profile production`) and add your Gmail as
   a tester.
2. Play Console → Settings → **License testing** → add the same Gmail →
   license response "RESPOND_NORMALLY". License testers buy with test cards —
   no real money.
3. On the test device (signed into that Gmail, app installed from the test
   track): buy `credits_starter` → the app calls `POST /payments/google/verify`
   → credits appear. Re-tap: **no double grant** (replay-safe).
4. Subscribe to `premium_monthly` → role flips to PREMIUM. Cancel in Play →
   within minutes RTDN delivers → PREMIUM revoked (check /profile).
5. Refund the credit purchase from Play Console → Order management → RTDN
   voided-purchase → credits clawed back (clamped at balance).
6. "Restore purchases" on the pricing screen re-verifies owned purchases
   (idempotent — nothing double-grants).

## 6. What's already handled server-side

- Verification is server-authoritative (`purchases.products.get` /
  `purchases.subscriptionsv2.get`); the client's word is never trusted.
- Grants flow through the same status-guarded, exactly-once settle path as
  Cashfree; replayed tokens and cross-account replays are rejected.
- Purchases are acknowledged server-side (unacknowledged purchases would be
  auto-refunded by Play after ~3 days).
- Unknown RTDN types are acked without side effects (no Pub/Sub retry storms).
