/**
 * Thin wrapper over react-native-iap for the Play Billing rail (Rail B).
 *
 * Flow per the app plan §5: buy the SKU from Play → send the purchase token to
 * POST /payments/google/verify (server-authoritative grant through the same
 * settle path as Cashfree) → ONLY after the backend verifies, finish/consume
 * the transaction. Restore re-verifies every available purchase (idempotent —
 * the backend's unique keys make replays no-ops).
 *
 * react-native-iap is REQUIRED LAZILY inside each function: the native module
 * is absent in Expo Go and under Jest, and must not crash module import. All
 * failures resolve to a typed result, never a throw.
 */
import { endpoints, ApiError } from '@myastro360/shared';
import { api } from '@/api/client';
import { planForSku } from './products';

// Types only — erased at runtime, safe without the native module.
import type * as IapTypes from 'react-native-iap';

export interface PurchaseOutcome {
  ok: boolean;
  creditsAdded?: number;
  entitlementGranted?: boolean;
  /** User-facing message on failure (cancelled, network, verify rejection…). */
  message?: string;
}

interface VerifyResponse {
  verified: boolean;
  creditsAdded?: number;
  entitlementGranted?: boolean;
}

function loadIap(): typeof IapTypes | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-iap') as typeof IapTypes;
  } catch {
    return null; // Expo Go / tests — Play Billing unavailable
  }
}

let initialized = false;

export async function initIAP(): Promise<boolean> {
  const iap = loadIap();
  if (!iap) return false;
  if (initialized) return true;
  try {
    await iap.initConnection();
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export interface CatalogEntry {
  sku: string;
  /** Localized price string from Play (e.g. "₹99.00"); null when unavailable. */
  localizedPrice: string | null;
}

/** Localized store prices for the given SKUs (best-effort; [] offline). */
export async function getCatalog(productSkus: string[], subscriptionSkus: string[]): Promise<CatalogEntry[]> {
  const iap = loadIap();
  if (!iap || !(await initIAP())) return [];
  try {
    const [products, subs] = await Promise.all([
      iap.getProducts({ skus: productSkus }),
      iap.getSubscriptions({ skus: subscriptionSkus }),
    ]);
    return [...products, ...subs].map((p: any) => ({
      sku: p.productId,
      localizedPrice: p.localizedPrice ?? null,
    }));
  } catch {
    return [];
  }
}

/** Await the next purchase event for `sku` via the update/error listeners. */
function awaitPurchase(iap: typeof IapTypes, sku: string): Promise<IapTypes.ProductPurchase> {
  return new Promise((resolve, reject) => {
    const updateSub = iap.purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== sku) return;
      cleanup();
      resolve(purchase as IapTypes.ProductPurchase);
    });
    const errorSub = iap.purchaseErrorListener((error) => {
      cleanup();
      reject(new Error(error.message ?? 'Purchase failed'));
    });
    const cleanup = () => {
      updateSub.remove();
      errorSub.remove();
    };
  });
}

async function verifyWithBackend(
  sku: string,
  purchase: IapTypes.ProductPurchase,
  kind: 'product' | 'subscription',
): Promise<VerifyResponse> {
  return api.post<VerifyResponse>(endpoints.payments.googleVerify, {
    productId: sku,
    purchaseToken: purchase.purchaseToken,
    kind,
    ...(purchase.transactionId ? { orderId: purchase.transactionId } : {}),
  });
}

async function buy(sku: string, kind: 'product' | 'subscription'): Promise<PurchaseOutcome> {
  const iap = loadIap();
  if (!iap || !(await initIAP())) {
    return { ok: false, message: 'In-app purchases are unavailable on this device/build.' };
  }
  try {
    const pending = awaitPurchase(iap, sku);
    if (kind === 'subscription') {
      const subs = await iap.getSubscriptions({ skus: [sku] });
      const offerToken = (subs[0] as any)?.subscriptionOfferDetails?.[0]?.offerToken;
      await iap.requestSubscription({
        sku,
        ...(offerToken ? { subscriptionOffers: [{ sku, offerToken }] } : {}),
      } as any);
    } else {
      await iap.requestPurchase({ skus: [sku] } as any);
    }
    const purchase = await pending;
    if (!purchase.purchaseToken) return { ok: false, message: 'Play returned no purchase token.' };

    const verified = await verifyWithBackend(sku, purchase, kind);
    if (!verified.verified) return { ok: false, message: 'Purchase could not be verified.' };

    // Finish ONLY after the backend granted — credits packs are consumable so
    // they can be bought again; entitlements/subscriptions are not.
    await iap
      .finishTransaction({ purchase, isConsumable: kind === 'product' && sku.startsWith('credits_') })
      .catch(() => {});

    return { ok: true, creditsAdded: verified.creditsAdded, entitlementGranted: verified.entitlementGranted };
  } catch (e) {
    const message =
      e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Purchase failed.';
    return { ok: false, message };
  }
}

export const buyProduct = (sku: string) => buy(sku, 'product');
export const buySubscription = (sku: string) => buy(sku, 'subscription');

/** Re-verify every owned purchase (idempotent server-side). */
export async function restorePurchases(): Promise<{ restored: number; message?: string }> {
  const iap = loadIap();
  if (!iap || !(await initIAP())) {
    return { restored: 0, message: 'In-app purchases are unavailable on this device/build.' };
  }
  try {
    const owned = await iap.getAvailablePurchases();
    let restored = 0;
    for (const purchase of owned) {
      if (!purchase.purchaseToken) continue;
      const kind = planForSku(purchase.productId) ? 'subscription' : 'product';
      try {
        const res = await verifyWithBackend(purchase.productId, purchase, kind);
        if (res.verified) restored++;
      } catch {
        /* keep going — restore is best-effort per purchase */
      }
    }
    return { restored };
  } catch (e) {
    return { restored: 0, message: e instanceof Error ? e.message : 'Restore failed.' };
  }
}
