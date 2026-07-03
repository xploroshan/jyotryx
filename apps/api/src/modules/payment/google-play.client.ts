import { JWT } from 'google-auth-library';

/**
 * Minimal Google Play Developer API (androidpublisher v3) client — the Play
 * analogue of `cashfree.client.ts`. Authenticates with a dedicated service
 * account (AndroidPublisher scope) via google-auth-library's JWT client; we
 * call the REST endpoints directly rather than pulling in the monolithic
 * `googleapis` package.
 *
 * Used to validate purchase tokens the mobile app presents after a Play
 * Billing purchase, and to acknowledge purchases (Play refunds unacknowledged
 * purchases after ~3 days).
 */

export interface GooglePlayConfig {
  /** Single-line service-account JSON (client_email + private_key). */
  serviceAccountJson: string;
  /** Android applicationId, e.g. com.myastro360.app */
  packageName: string;
}

/** purchases.products.get response (fields we use). */
export interface ProductPurchase {
  /** 0 = purchased, 1 = canceled, 2 = pending */
  purchaseState?: number;
  /** 0 = yet to be consumed, 1 = consumed */
  consumptionState?: number;
  /** 0 = yet to be acknowledged, 1 = acknowledged */
  acknowledgementState?: number;
  orderId?: string;
  purchaseTimeMillis?: string;
  regionCode?: string;
  [key: string]: unknown;
}

/** purchases.subscriptionsv2.get response (fields we use). */
export interface SubscriptionPurchaseV2 {
  /** e.g. SUBSCRIPTION_STATE_ACTIVE / _CANCELED / _EXPIRED / _IN_GRACE_PERIOD */
  subscriptionState?: string;
  /** ACKNOWLEDGEMENT_STATE_PENDING | ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED */
  acknowledgementState?: string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  regionCode?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  [key: string]: unknown;
}

const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export class GooglePlayClient {
  private readonly jwt: JWT;
  private readonly packageName: string;

  constructor(config: GooglePlayConfig) {
    const parsed = JSON.parse(config.serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };
    this.jwt = new JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: [SCOPE],
    });
    this.packageName = config.packageName;
  }

  private url(path: string): string {
    return `${BASE}/${encodeURIComponent(this.packageName)}/${path}`;
  }

  async getProductPurchase(sku: string, purchaseToken: string): Promise<ProductPurchase> {
    const res = await this.jwt.request<ProductPurchase>({
      url: this.url(
        `purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}`,
      ),
    });
    return res.data;
  }

  async getSubscriptionPurchase(purchaseToken: string): Promise<SubscriptionPurchaseV2> {
    const res = await this.jwt.request<SubscriptionPurchaseV2>({
      url: this.url(`purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`),
    });
    return res.data;
  }

  async acknowledgeProduct(sku: string, purchaseToken: string): Promise<void> {
    await this.jwt.request({
      url: this.url(
        `purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      ),
      method: 'POST',
      data: {},
    });
  }

  async acknowledgeSubscription(sku: string, purchaseToken: string): Promise<void> {
    // v2 has no acknowledge; the v1 subscriptions acknowledge endpoint is the
    // documented path for subscription acks.
    await this.jwt.request({
      url: this.url(
        `purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      ),
      method: 'POST',
      data: {},
    });
  }
}
