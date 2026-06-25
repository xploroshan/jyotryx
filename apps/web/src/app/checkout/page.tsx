"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { track } from "@/lib/analytics";

/**
 * One-time Razorpay checkout for credit packs AND pay-to-unlock products
 * (reports, palmistry).
 *
 * Flow (Razorpay "Orders" + client Checkout):
 *   1. Read `?type=<credits|report|palmistry>&pack=<id>`.
 *        • credits   → pack = credit pack id (starter/popular/pro)
 *        • report    → pack = report type (LIFE/CAREER/MARRIAGE/…)
 *        • palmistry → pack ignored
 *   2. Fetch the authoritative price from /payments/pricing (the same
 *      SiteSettings the pricing page renders).
 *   3. POST /payments/create-order → Razorpay order_id.
 *   4. Open the Razorpay Checkout modal with that order.
 *   5. On success, POST /payments/verify (server checks the HMAC signature
 *      and grants credits OR a one-time entitlement exactly once).
 *   6. credits → reflect new balance and go to /chat. report/palmistry →
 *      bounce back to the feature page with `?unlocked=…` so it generates
 *      immediately.
 *
 * Subscriptions are NOT handled here — those use Razorpay's hosted page
 * via a server-returned shortUrl from /pricing.
 */

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const REPORT_TITLES: Record<string, string> = {
  LIFE: "Detailed Life Report",
  CAREER: "Career & Finance Report",
  MARRIAGE: "Marriage & Compatibility Report",
  WEALTH: "Wealth & Money Report",
  ANNUAL: "Annual Forecast Report",
  PALM: "Palmistry Report",
};

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler?: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (response: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/** Inject the Razorpay Checkout script once; resolve when it's ready. */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

interface VerifyResult {
  verified: boolean;
  creditsAdded?: number;
  entitlementGranted?: boolean;
}

/** What the checkout is selling, derived from the query string. */
interface ResolvedProduct {
  kind: "credits" | "report" | "palmistry";
  productId: string;
  /** SiteSettings key holding the INR price. */
  priceKey: string;
  /** SiteSettings key holding the credit count (credits only). */
  creditsKey?: string;
  title: string;
  /** Where to send the user after a successful purchase. */
  successRedirect: string;
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useTranslation();
  const hydrated = useAuthHydrated();
  const { isAuthenticated, accessToken, user, updateCredits } = useAuthStore();

  const type = params.get("type") ?? "credits";
  const pack = params.get("pack") ?? "";

  const product: ResolvedProduct | null = useMemo(() => {
    if (type === "report") {
      const rt = (pack || "LIFE").toUpperCase();
      return {
        kind: "report",
        productId: `report_${rt.toLowerCase()}`,
        priceKey: "pricing.report.price",
        title: REPORT_TITLES[rt] ?? "Astrology Report",
        successRedirect: `/reports?unlocked=${rt}`,
      };
    }
    if (type === "palmistry") {
      return {
        kind: "palmistry",
        productId: "palm_reading",
        priceKey: "pricing.palmistry.price",
        title: "Palm Reading",
        successRedirect: "/palmistry?unlocked=1",
      };
    }
    if (type === "credits" && pack) {
      return {
        kind: "credits",
        productId: `credits_${pack}`,
        priceKey: `pricing.credits.${pack}.price`,
        creditsKey: `pricing.credits.${pack}.credits`,
        title: `${t.pricing.creditPacksTitle}`,
        successRedirect: "/chat",
      };
    }
    return null;
  }, [type, pack, t]);

  const [price, setPrice] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingPack, setLoadingPack] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ credits: number | null } | null>(null);

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  const fmt = useMemo(
    () =>
      (n: number) =>
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          minimumFractionDigits: 0,
        }).format(n),
    [],
  );

  // Bounce unauthenticated visitors to sign-up, preserving where they were
  // headed so they land back on checkout after authenticating.
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      const next = encodeURIComponent(`/checkout?type=${type}&pack=${pack}`);
      router.replace(`/auth?mode=signup&next=${next}`);
    }
  }, [hydrated, isAuthenticated, router, type, pack]);

  // Resolve the product's price (+ credit count for packs) from the public
  // pricing config.
  useEffect(() => {
    if (!product) {
      setLoadingPack(false);
      return;
    }
    let cancelled = false;
    setLoadingPack(true);
    api
      .get<Record<string, string>>("/payments/pricing")
      .then((settings) => {
        if (cancelled) return;
        const p = parseInt(settings[product.priceKey] || "", 10);
        setPrice(Number.isFinite(p) && p > 0 ? p : null);
        if (product.creditsKey) {
          const c = parseInt(settings[product.creditsKey] || "", 10);
          setCredits(Number.isFinite(c) && c > 0 ? c : null);
        } else {
          setCredits(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrice(null);
          setCredits(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPack(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  const startPayment = async () => {
    if (!product || price === null) return;
    if (product.kind === "credits" && credits === null) return;
    setError("");

    if (!keyId) {
      setError(t.common.error);
      return;
    }

    setProcessing(true);
    try {
      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) {
        setError(t.common.error);
        setProcessing(false);
        return;
      }

      const order = await api.post<RazorpayOrder>(
        "/payments/create-order",
        {
          amount: price * 100, // paise
          currency: "INR",
          productId: product.productId,
          description: product.title,
        },
        { token: accessToken! },
      );

      track("checkout_started", { product: product.productId, kind: product.kind, amount: price });
      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "MyAstro360",
        description: product.title,
        prefill: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
          contact: user?.phone ?? undefined,
        },
        theme: { color: "#b45309" },
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            const result = await api.post<VerifyResult>(
              "/payments/verify",
              {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
              { token: accessToken! },
            );
            if (result.verified) {
              track("purchase", { product: product.productId, kind: product.kind, amount: price });
              if (product.kind === "credits") {
                const added = result.creditsAdded ?? credits ?? 0;
                if (user) updateCredits(user.credits + added);
                setSuccess({ credits: added });
              } else {
                setSuccess({ credits: null });
              }
              setTimeout(() => router.push(product.successRedirect), 1600);
            } else {
              setError(t.common.error);
            }
          } catch {
            // Payment may still have succeeded server-side via webhook;
            // surface a soft error and let the user check their balance.
            setError(t.common.error);
          } finally {
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
      });
      rzp.on("payment.failed", () => {
        setError(t.common.error);
        setProcessing(false);
      });
      rzp.open();
    } catch {
      setError(t.common.error);
      setProcessing(false);
    }
  };

  // Until the auth store rehydrates we can't tell whether to render or
  // redirect — show a neutral loading state to avoid a flash.
  if (!hydrated || (!isAuthenticated && hydrated)) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm text-[rgba(12,8,5,0.66)]">{t.common.loading}</p>
      </div>
    );
  }

  const invalidPack =
    !loadingPack &&
    (!product || price === null || (product.kind === "credits" && credits === null));

  const backHref = product?.kind === "report" ? "/reports" : product?.kind === "palmistry" ? "/palmistry" : "/pricing";

  return (
    <div className="mx-auto max-w-md px-4 py-16 fade-in-up">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs text-[rgba(12,8,5,0.72)] hover:text-surface-950 mb-6"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t.common.back}
      </Link>

      <h1 className="text-2xl font-bold text-surface-950 mb-6 tracking-tight">
        {product?.kind === "credits" ? t.pricing.creditPacksTitle : product?.title}
      </h1>

      {success !== null ? (
        <div className="surface-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-surface-950">
            {success.credits !== null
              ? `+${success.credits} ${t.pricing.credits}`
              : "Unlocked!"}
          </div>
          <p className="mt-2 text-xs text-[rgba(12,8,5,0.66)]">{t.common.loading}</p>
        </div>
      ) : loadingPack ? (
        <div className="surface-card p-6 animate-pulse" data-testid="checkout-skeleton">
          <div className="h-4 w-24 rounded bg-[rgba(12,8,5,0.07)] mb-4" />
          <div className="h-10 w-32 rounded bg-[rgba(12,8,5,0.07)] mb-6" />
          <div className="h-10 w-full rounded bg-[rgba(12,8,5,0.07)]" />
        </div>
      ) : invalidPack ? (
        <div className="surface-card p-6 text-center">
          <p className="text-sm text-[rgba(12,8,5,0.72)] mb-4">{t.common.error}</p>
          <button onClick={() => router.push(backHref)} className="btn-secondary px-4 py-2 rounded-lg text-sm">
            {t.common.back}
          </button>
        </div>
      ) : (
        <div className="surface-card p-6">
          <div className="flex items-baseline justify-between border-b border-[rgba(12,8,5,0.08)] pb-4 mb-4">
            <span className="text-sm font-medium text-surface-950">
              {product?.kind === "credits"
                ? `${credits} ${t.pricing.credits}`
                : product?.title}
            </span>
            <span className="text-2xl font-bold text-surface-950">{fmt(price!)}</span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center">
              {error}
            </div>
          )}

          <button
            onClick={startPayment}
            disabled={processing}
            className="w-full py-2.5 rounded-lg text-sm font-medium btn-primary disabled:opacity-50"
          >
            {processing ? t.common.processing : `${t.pricing.buyNow} · ${fmt(price!)}`}
          </button>

          {error && (
            <button
              onClick={startPayment}
              disabled={processing}
              className="w-full mt-2 py-2 rounded-lg text-xs font-medium btn-secondary disabled:opacity-50"
            >
              {t.common.retry}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="text-sm text-[rgba(12,8,5,0.66)]">{t.common.loading}</p>
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
