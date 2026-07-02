/**
 * Play Billing SKU catalog + pricing parser. Pure (no React/native) — unit-
 * tested in products.test.ts.
 *
 * SKU ids are the SAME productIds the web sends to /payments/create-order
 * (verified against the web checkout): credit packs `credits_starter/popular/
 * pro`, reports `report_<type>`, palmistry `palm_reading`, subscriptions
 * `premium_monthly|premium_annual`. The backend's google/verify resolves them
 * with the same helpers as Cashfree, so the two rails can never drift.
 *
 * `parsePricing` mirrors the web `usePricingConfig` parsing exactly: booleans
 * are strict `=== 'true'`; numbers are `parseInt` and must be finite and > 0,
 * else the fallback applies.
 */

export interface CreditPack {
  sku: string;
  packId: 'starter' | 'popular' | 'pro';
  label: string;
  credits: number;
  priceINR: number;
}

export interface StorePolicy {
  region: string;
  allowWebCheckoutLink: boolean;
}

export interface PricingInfo {
  packs: CreditPack[];
  monthlyPrice: number;
  annualPrice: number;
  recommended: 'monthly' | 'annual';
  reportPrice: number;
  palmistryPrice: number;
  subscriptionsEnabled: boolean;
  pricingEnabled: boolean;
  freeMode: boolean;
  storePolicy: StorePolicy;
}

/** Default pack definitions (overridden by SiteSettings via parsePricing). */
const PACK_DEFAULTS: { packId: CreditPack['packId']; label: string; credits: number; priceINR: number }[] = [
  { packId: 'starter', label: 'Starter', credits: 50, priceINR: 99 },
  { packId: 'popular', label: 'Popular', credits: 150, priceINR: 249 },
  { packId: 'pro', label: 'Pro', credits: 500, priceINR: 699 },
];

export const SUBSCRIPTION_SKUS = {
  monthly: 'premium_monthly',
  annual: 'premium_annual',
} as const;

export function planForSku(sku: string): 'MONTHLY' | 'ANNUAL' | null {
  if (sku === SUBSCRIPTION_SKUS.monthly) return 'MONTHLY';
  if (sku === SUBSCRIPTION_SKUS.annual) return 'ANNUAL';
  return null;
}

export const PALMISTRY_SKU = 'palm_reading';

/** Report type (LIFE/CAREER/…) → its one-time-unlock SKU. */
export function reportSku(reportType: string): string {
  return `report_${reportType.toLowerCase()}`;
}

/** All product SKUs to request from the Play catalog. */
export function allProductSkus(): string[] {
  return [
    ...PACK_DEFAULTS.map((p) => `credits_${p.packId}`),
    ...['life', 'career', 'marriage', 'wealth', 'annual', 'palm'].map((t) => `report_${t}`),
    PALMISTRY_SKU,
  ];
}

const num = (raw: Record<string, string>, key: string, fallback: number): number => {
  const n = parseInt(raw[key] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const bool = (raw: Record<string, string>, key: string): boolean => raw[key] === 'true';

export function parsePricing(raw: Record<string, string>): PricingInfo {
  const packs: CreditPack[] = PACK_DEFAULTS.map((d) => ({
    sku: `credits_${d.packId}`,
    packId: d.packId,
    label: d.label,
    credits: num(raw, `pricing.credits.${d.packId}.credits`, d.credits),
    priceINR: num(raw, `pricing.credits.${d.packId}.price`, d.priceINR),
  }));

  return {
    packs,
    monthlyPrice: num(raw, 'pricing.monthly.price', 499),
    annualPrice: num(raw, 'pricing.annual.price', 4999),
    recommended: raw['pricing.recommended'] === 'monthly' ? 'monthly' : 'annual',
    reportPrice: num(raw, 'pricing.report.price', 199),
    palmistryPrice: num(raw, 'pricing.palmistry.price', 250),
    subscriptionsEnabled: bool(raw, 'feature.subscriptions_enabled'),
    pricingEnabled: bool(raw, 'feature.pricing_page_enabled'),
    freeMode: bool(raw, 'feature.free_mode'),
    storePolicy: {
      region: raw['storePolicy.region'] || 'IN',
      // Fail-closed anti-steering: only an explicit 'true' shows web links.
      allowWebCheckoutLink: raw['storePolicy.allowWebCheckoutLink'] === 'true',
    },
  };
}
