"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { track } from "@/lib/analytics";
import { loadCashfree } from "@/lib/cashfree";

/**
 * One-time Cashfree checkout for credit packs AND pay-to-unlock products
 * (reports, palmistry).
 *
 * Flow (Cashfree "Orders" + JS SDK v3):
 *   1. Read `?type=<credits|report|palmistry>&pack=<id>`.
 *        • credits   → pack = credit pack id (starter/popular/pro)
 *        • report    → pack = report type (LIFE/CAREER/MARRIAGE/…)
 *        • palmistry → pack ignored
 *   2. Fetch the authoritative price from /payments/pricing (INR rupees).
 *   3. POST /payments/create-order → { orderId, paymentSessionId }.
 *   4. Open the Cashfree checkout with that payment_session_id.
 *   5. On completion, POST /payments/verify { orderId } — the SERVER confirms
 *      the order is PAID with Cashfree and grants credits OR a one-time
 *      entitlement exactly once. No client-side signature is trusted.
 *   6. credits → reflect new balance and go to /chat. report/palmistry →
 *      bounce back to the feature page with `?unlocked=…`.
 *
 * Amounts are sent in INR rupees (Cashfree uses rupees, not paise).
 * Subscriptions are NOT handled here — those use the Cashfree subscription
 * authorization flow from /pricing.
 */

const REPORT_TITLES: Record<string, string> = {
  LIFE: "Detailed Life Report",
  CAREER: "Career & Finance Report",
  MARRIAGE: "Marriage & Compatibility Report",
  WEALTH: "Wealth & Money Report",
  ANNUAL: "Annual Forecast Report",
  PALM: "Palmistry Report",
};

interface CreateOrderResponse {
  orderId: string;
  paymentSessionId: string | null;
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

    setProcessing(true);
    try {
      const cashfree = await loadCashfree();
      if (!cashfree) {
        setError(t.common.error);
        setProcessing(false);
        return;
      }

      const order = await api.post<CreateOrderResponse>(
        "/payments/create-order",
        {
          amount: price, // INR rupees (Cashfree uses rupees, not paise)
          currency: "INR",
          productId: product.productId,
          description: product.title,
        },
        { token: accessToken! },
      );

      if (!order.paymentSessionId) {
        setError(t.common.error);
        setProcessing(false);
        return;
      }

      track("checkout_started", { product: product.productId, kind: product.kind, amount: price });

      const result = await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_modal",
      });

      // User dismissed the modal or a client-side error occurred — surface it
      // and let them retry. (A genuine payment is confirmed server-side below.)
      if (result?.error) {
        setError(t.common.error);
        setProcessing(false);
        return;
      }

      // Server-authoritative confirmation: the backend re-checks the order
      // status with Cashfree and grants exactly once.
      try {
        const verify = await api.post<VerifyResult>(
          "/payments/verify",
          { orderId: order.orderId },
          { token: accessToken! },
        );
        if (verify.verified) {
          track("purchase", { product: product.productId, kind: product.kind, amount: price });
          if (product.kind === "credits") {
            const added = verify.creditsAdded ?? credits ?? 0;
            if (user) updateCredits(user.credits + added);
            setSuccess({ credits: added });
          } else {
            setSuccess({ credits: null });
          }
          setTimeout(() => router.push(product.successRedirect), 1600);
        } else {
          // Not settled yet (or pending) — the webhook may still grant it.
          setError(t.common.error);
        }
      } catch {
        // Payment may still have succeeded server-side via webhook; surface a
        // soft error and let the user check their balance.
        setError(t.common.error);
      } finally {
        setProcessing(false);
      }
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
