/**
 * Shared loader + typings for the Cashfree JS SDK v3 (CDN global).
 *
 * The client is only ever given the public `mode` (NEXT_PUBLIC_CASHFREE_MODE)
 * and a server-issued `payment_session_id` / subscription session — never the
 * client secret. All authorization happens against Cashfree directly; our
 * backend confirms the result server-side.
 */

export const CASHFREE_MODE =
  (process.env.NEXT_PUBLIC_CASHFREE_MODE as "sandbox" | "production") || "sandbox";

const CASHFREE_SCRIPT_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

export type RedirectTarget = "_self" | "_blank" | "_modal" | "_top";

export interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  redirectTarget?: RedirectTarget;
  returnUrl?: string;
}

export interface CashfreeSubscriptionOptions {
  subscriptionSessionId: string;
  redirectTarget?: RedirectTarget;
  returnUrl?: string;
}

export interface CashfreeResult {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}

export interface CashfreeInstance {
  checkout: (options: CashfreeCheckoutOptions) => Promise<CashfreeResult>;
  subscriptionsCheckout?: (options: CashfreeSubscriptionOptions) => Promise<CashfreeResult>;
}

type CashfreeFactory = (config: { mode: "sandbox" | "production" }) => CashfreeInstance;

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

/**
 * Inject the Cashfree SDK once and return an initialized instance (or null if
 * the script fails to load / runs server-side).
 */
export function loadCashfree(): Promise<CashfreeInstance | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const make = () => resolve(window.Cashfree ? window.Cashfree({ mode: CASHFREE_MODE }) : null);
    if (window.Cashfree) return make();

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CASHFREE_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", make, { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CASHFREE_SCRIPT_SRC;
    script.async = true;
    script.onload = make;
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}
