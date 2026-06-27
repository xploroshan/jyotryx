import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Minimal, dependency-free Cashfree Payment Gateway client (API version
 * `2025-01-01`). We deliberately avoid the `cashfree-pg` SDK: a thin `fetch`
 * wrapper is auditable, has no transitive supply-chain surface, and lets us
 * pin the exact request/response shapes the payment service relies on.
 *
 * Base URLs:
 *   sandbox    → https://sandbox.cashfree.com/pg
 *   production → https://api.cashfree.com/pg
 *
 * Every server-to-server call is authenticated with `x-client-id` +
 * `x-client-secret` and versioned with `x-api-version`. The client secret is
 * NEVER exposed to the browser — the web only ever receives a
 * `payment_session_id` / subscription session.
 */

export interface CashfreeConfig {
  clientId: string;
  clientSecret: string;
  /** 'sandbox' | 'production' */
  mode: string;
  apiVersion: string;
}

export interface CreateOrderParams {
  orderId: string;
  /** Order amount in INR **rupees** (Cashfree uses rupees, not paise). */
  orderAmount: number;
  orderCurrency: string;
  customer: { id: string; name?: string | null; email?: string | null; phone?: string | null };
  returnUrl?: string;
  notifyUrl?: string;
}

export interface CashfreeOrderResponse {
  cf_order_id?: string | number;
  order_id: string;
  order_status: string; // ACTIVE | PAID | EXPIRED | TERMINATED ...
  order_amount: number; // rupees
  order_currency?: string;
  payment_session_id?: string;
}

export interface CreateRefundParams {
  refundId: string;
  refundAmount: number;
  refundNote?: string;
}

/**
 * Thrown when Cashfree returns a non-2xx response. Carries the HTTP status so
 * the caller can decide how to map it (we surface a generic 500 to the client
 * and never leak Cashfree internals).
 */
export class CashfreeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CashfreeApiError';
  }
}

export class CashfreeClient {
  private readonly logger = new Logger(CashfreeClient.name);
  private readonly baseUrl: string;

  constructor(private readonly cfg: CashfreeConfig) {
    this.baseUrl =
      cfg.mode === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
  }

  get isProductionMode(): boolean {
    return this.cfg.mode === 'production';
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-version': this.cfg.apiVersion,
      'x-client-id': this.cfg.clientId,
      'x-client-secret': this.cfg.clientSecret,
      ...(extra ?? {}),
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.buildHeaders(
        idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
      ),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json: any = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = {};
      }
    }

    if (!res.ok) {
      // Log the Cashfree error message for operators, but throw a sanitized
      // error — the controller maps this to a generic 500 so we never leak
      // gateway internals (or the secret echoed in some error bodies).
      this.logger.error(
        `Cashfree ${method} ${path} failed: ${res.status} ${
          json?.message ?? text.slice(0, 200)
        }`,
      );
      throw new CashfreeApiError(
        json?.message ?? `Cashfree request failed (${res.status})`,
        res.status,
      );
    }
    return json as T;
  }

  // ── Orders (one-time payments) ──────────────────────────────────────────

  createOrder(p: CreateOrderParams): Promise<CashfreeOrderResponse> {
    const orderMeta: Record<string, string> = {};
    if (p.returnUrl) orderMeta.return_url = p.returnUrl;
    if (p.notifyUrl) orderMeta.notify_url = p.notifyUrl;

    return this.request<CashfreeOrderResponse>(
      'POST',
      '/orders',
      {
        order_id: p.orderId,
        order_amount: p.orderAmount,
        order_currency: p.orderCurrency,
        customer_details: {
          // Cashfree customer_id accepts alphanumerics/_/-, but we strip the
          // UUID dashes defensively to stay well within its charset.
          customer_id: p.customer.id.replace(/-/g, ''),
          customer_name: p.customer.name ?? undefined,
          customer_email: p.customer.email ?? undefined,
          // A valid 10-digit phone is required by Cashfree; fall back to a
          // neutral placeholder when the user has none on file.
          customer_phone: normalizePhone(p.customer.phone),
        },
        order_meta: Object.keys(orderMeta).length ? orderMeta : undefined,
      },
      // Idempotent create: a retried create-order for the same orderId will
      // not mint a duplicate order on Cashfree's side.
      p.orderId,
    );
  }

  getOrder(orderId: string): Promise<CashfreeOrderResponse> {
    return this.request<CashfreeOrderResponse>(
      'GET',
      `/orders/${encodeURIComponent(orderId)}`,
    );
  }

  createRefund(orderId: string, p: CreateRefundParams): Promise<any> {
    return this.request(
      'POST',
      `/orders/${encodeURIComponent(orderId)}/refunds`,
      {
        refund_id: p.refundId,
        refund_amount: p.refundAmount,
        refund_note: p.refundNote,
      },
      p.refundId,
    );
  }

  // ── Subscriptions (recurring) ───────────────────────────────────────────

  createSubscription(body: Record<string, unknown>): Promise<any> {
    return this.request('POST', '/subscriptions', body, String(body.subscription_id));
  }

  getSubscription(subscriptionId: string): Promise<any> {
    return this.request('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  }

  manageSubscription(subscriptionId: string, body: Record<string, unknown>): Promise<any> {
    return this.request(
      'POST',
      `/subscriptions/${encodeURIComponent(subscriptionId)}/manage`,
      body,
    );
  }

  raiseCharge(body: Record<string, unknown>): Promise<any> {
    return this.request('POST', '/subscriptions/pay', body);
  }
}

/** Cashfree requires a 10-digit Indian phone; coerce/placeholder defensively. */
function normalizePhone(phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  // Strip a leading country code (91) if a full +91XXXXXXXXXX was stored.
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return local.length === 10 ? local : '9999999999';
}

/**
 * Verify a Cashfree webhook signature.
 *
 * Cashfree signs the webhook as:
 *   base64( HMAC_SHA256( key = client_secret, data = timestamp + rawBody ) )
 * sent in the `x-webhook-signature` header alongside `x-webhook-timestamp`.
 *
 * Two security-relevant differences from Razorpay's scheme:
 *   1. The digest is **base64**, not hex.
 *   2. The **timestamp is authenticated** (it is part of the signed data), so a
 *      captured-and-replayed delivery can be rejected by checking the timestamp
 *      against a freshness window (done by the caller).
 *
 * The signature MUST be computed over the exact raw bytes Cashfree sent —
 * re-serializing the parsed JSON re-coerces decimal amounts/whitespace and
 * fails verification for every legitimate webhook. The comparison is
 * constant-time to avoid leaking a timing side channel.
 */
export function verifyCashfreeSignature(
  secret: string,
  timestamp: string,
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .update(rawBody)
    .digest('base64');
  return safeBase64Equal(expected, signature);
}

/**
 * Constant-time compare of two base64 strings. `timingSafeEqual` throws on
 * unequal-length buffers, so we bail early on a length mismatch (which itself
 * leaks no useful signal — a forged signature of the wrong length is simply
 * wrong).
 */
export function safeBase64Equal(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}
