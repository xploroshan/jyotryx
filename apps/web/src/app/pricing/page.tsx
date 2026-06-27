"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { Stagger } from "@/components/ui/PageTransition";
import { track } from "@/lib/analytics";
import { jsonLdHtml } from "@/lib/seo/json-ld";
import { loadCashfree } from "@/lib/cashfree";

type Plan = {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  cta: string;
  popular: boolean;
  /** Annual only: the monthly-equivalent price, shown as the value anchor
   *  ("≈ ₹417/mo") — the meter-never-runs pillar made concrete. */
  monthlyEquiv?: number;
  /** Annual only: % saved vs paying monthly for 12 months. */
  savingsPct?: number;
};

type CreditPack = {
  id: string;
  credits: number;
  price: number;
  popular?: boolean;
};

export default function PricingPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Build plan objects from the server-side pricing settings. The key
  // invariant: we NEVER render prices until the fetch completes, so the
  // user can't see a hardcoded default value flash before the real one.
  const buildPlans = (settings: Record<string, string>): Plan[] => {
    const monthlyPrice = parseInt(settings["pricing.monthly.price"] || "499", 10);
    const annualPrice = parseInt(settings["pricing.annual.price"] || "4999", 10);
    // Which paid plan is presented as the default/recommended option. Annual
    // is the default: it brings cash forward and lifts LTV — the single
    // biggest lever for a bootstrapped runway. Operator-overridable for A/B via
    // the `pricing.recommended` SiteSetting (values "annual" | "monthly"), no
    // redeploy. Annual is also placed in the centre column where the eye lands.
    const recommended = (settings["pricing.recommended"] || "annual").toLowerCase();
    const monthlyEquiv = Math.round(annualPrice / 12);
    const savingsPct =
      monthlyPrice > 0 ? Math.max(0, Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100)) : 0;
    return [
      {
        id: "free", name: t.pricing.planFreeName, price: 0, period: "",
        features: [t.pricing.featFreeLimited, t.pricing.featFreeChat, t.pricing.featFreeHoroscope, t.pricing.featFreePanchang],
        cta: t.pricing.ctaGetStarted, popular: false,
      },
      {
        id: "annual", name: t.pricing.planAnnualName, price: annualPrice, period: t.pricing.perYear,
        features: [t.pricing.featAnnualAll, t.pricing.featAnnualSave, t.pricing.featAnnualReports, t.pricing.featAnnualEarly, t.pricing.featAnnualDedicated],
        cta: t.pricing.ctaBestValue, popular: recommended === "annual",
        monthlyEquiv, savingsPct,
      },
      {
        id: "monthly", name: t.pricing.planPremiumName, price: monthlyPrice, period: t.pricing.perMonth,
        features: [t.pricing.featPremiumChat, t.pricing.featPremiumKundli, t.pricing.featPremiumMatching, t.pricing.featPremiumPalm, t.pricing.featPremiumHoroscope, t.pricing.featPremiumMuhurat, t.pricing.featPremiumReports, t.pricing.featPremiumSupport],
        cta: t.pricing.ctaSubscribe, popular: recommended === "monthly",
      },
    ];
  };

  const buildCreditPacks = (settings: Record<string, string>): CreditPack[] => [
    {
      id: "starter",
      credits: parseInt(settings["pricing.credits.starter.credits"] || "50", 10),
      price: parseInt(settings["pricing.credits.starter.price"] || "99", 10),
    },
    {
      id: "popular",
      credits: parseInt(settings["pricing.credits.popular.credits"] || "150", 10),
      price: parseInt(settings["pricing.credits.popular.price"] || "249", 10),
      popular: true,
    },
    {
      id: "pro",
      credits: parseInt(settings["pricing.credits.pro.credits"] || "500", 10),
      price: parseInt(settings["pricing.credits.pro.price"] || "699", 10),
    },
  ];

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [creditPacks, setCreditPacks] = useState<CreditPack[] | null>(null);
  // null = still loading the flag; true/false once known. When the operator
  // has disabled the pricing page (Mode A "Free launch") we render a simple
  // "everything is free" panel instead of plans + credit packs.
  const [pricingEnabled, setPricingEnabled] = useState<boolean | null>(null);

  // Fire once: the user reached the pricing page (top of the revenue funnel).
  useEffect(() => {
    track("pricing_viewed");
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Reset to skeleton on every locale/fetch so the user never sees a
    // stale price briefly before the fresh one loads.
    setPlans(null);
    setCreditPacks(null);
    api.get<Record<string, string>>("/payments/pricing")
      .then((settings) => {
        if (cancelled) return;
        setPricingEnabled(settings["feature.pricing_page_enabled"] === "true");
        setPlans(buildPlans(settings));
        setCreditPacks(buildCreditPacks(settings));
      })
      .catch(() => {
        if (cancelled) return;
        // On error, fall back to the hardcoded defaults so the page is
        // still usable — this path is only hit when the backend is down.
        setPlans(buildPlans({}));
        setCreditPacks(buildCreditPacks({}));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) { router.push("/auth?mode=signup"); return; }
    if (planId === "free") { router.push("/chat"); return; }
    setLoading(planId); setError("");
    track("plan_selected", { plan: planId });
    try {
      const res = await api.post<{ id: string; authSessionId?: string; authLink?: string }>(
        "/payments/subscribe",
        { plan: planId === "monthly" ? "MONTHLY" : "ANNUAL" },
        { token: accessToken! },
      );
      // Open the Cashfree mandate authorization (UPI AutoPay / eNACH / card).
      // Premium is granted by the subscription webhook once the mandate is
      // authorised and the first charge settles — not here.
      if (res.authSessionId) {
        const cashfree = await loadCashfree();
        if (cashfree?.subscriptionsCheckout) {
          await cashfree.subscriptionsCheckout({
            subscriptionSessionId: res.authSessionId,
            redirectTarget: "_self",
          });
          return;
        }
      }
      if (res.authLink) {
        window.location.href = res.authLink;
        return;
      }
      setError(t.pricing.subscribeFailed);
    } catch (err: any) { setError(err.message || t.pricing.subscribeFailed); }
    finally { setLoading(null); }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n);

  // Offer structured data, built from the live pricing once it loads, so
  // search/answer engines can surface the plans and credit packs. Rendered
  // only when prices are known to avoid emitting placeholder amounts.
  const offerJsonLd =
    plans && creditPacks
      ? {
          "@context": "https://schema.org",
          "@type": "Service",
          name: "MyAstro360 Vedic Astrology",
          serviceType: "Online astrology consultation",
          provider: { "@type": "Organization", name: "MyAstro360" },
          offers: [
            ...plans
              .filter((p) => p.price > 0)
              .map((p) => ({
                "@type": "Offer",
                name: p.name,
                price: p.price,
                priceCurrency: "INR",
                category: "Subscription",
              })),
            ...creditPacks.map((c) => ({
              "@type": "Offer",
              name: `${c.credits} credits`,
              price: c.price,
              priceCurrency: "INR",
              category: "Credit pack",
            })),
          ],
        }
      : null;

  // Mode A: pricing/subscriptions disabled by the operator. The app is free
  // except the pay-per-use features (handled on their own pages), so we
  // don't show plans or credit packs here.
  if (pricingEnabled === false) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center fade-in-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full btn-secondary text-sm text-secondary mb-6">
          ✨ 100% Free
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-surface-950 mb-4 tracking-tight">
          Everything is <span className="text-gradient">free</span> right now
        </h1>
        <p className="text-sm text-[rgba(12,8,5,0.72)] max-w-md mx-auto mb-8">
          Explore your kundli, matching, panchang, horoscope, daily guidance and more — no
          subscription needed. Detailed reports and palm readings are available as one-time
          unlocks whenever you want them.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => router.push("/chat")} className="btn-primary px-6 py-2.5 rounded-xl text-sm text-white font-medium">
            Chat with an astrologer
          </button>
          <button onClick={() => router.push("/reports")} className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-medium">
            Get a report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 fade-in-up">
      {offerJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(offerJsonLd) }}
        />
      )}
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-surface-950 mb-3 tracking-tight">
          {t.pricing.titlePart1} <span className="text-gradient">{t.pricing.titleHighlight}</span>
        </h1>
        <p className="text-sm text-[rgba(12,8,5,0.66)] max-w-md mx-auto">
          {t.pricing.subtitle}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center max-w-md mx-auto">{error}</div>
      )}

      {/* Plans */}
      <Stagger.Container className="grid md:grid-cols-3 gap-4">
        {plans === null
          ? [0, 1, 2].map((i) => (
              <div key={i} className="surface-card p-6 animate-pulse" data-testid="plan-skeleton">
                <div className="h-4 w-24 rounded bg-[rgba(12,8,5,0.07)] mb-3" />
                <div className="h-10 w-32 rounded bg-[rgba(12,8,5,0.07)] mb-6" />
                <div className="space-y-2 mb-6">
                  <div className="h-3 w-full rounded bg-white/5" />
                  <div className="h-3 w-5/6 rounded bg-white/5" />
                  <div className="h-3 w-4/6 rounded bg-white/5" />
                </div>
                <div className="h-9 w-full rounded bg-[rgba(12,8,5,0.07)]" />
              </div>
            ))
          : plans.map((plan) => (
              <Stagger.Item key={plan.id} className={`surface-card p-6 relative transition-all duration-300 hover:-translate-y-0.5 ${plan.popular ? "border-primary-500/30 ring-1 ring-primary-500/10" : ""}`}>
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary-600 text-[11px] font-medium text-white">
                    {t.pricing.mostPopular}
                  </div>
                )}
                <h3 className="text-sm font-semibold text-surface-950 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  {plan.price > 0 ? (
                    <>
                      <span className="text-3xl font-bold text-surface-950">{fmt(plan.price)}</span>
                      <span className="text-xs text-[rgba(12,8,5,0.66)]">{plan.period}</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-surface-950">{t.pricing.free}</span>
                  )}
                </div>
                {/* Value anchor for the annual plan: the per-month equivalent +
                    savings vs paying monthly — "the meter never runs" in numbers. */}
                {plan.monthlyEquiv ? (
                  <p className="-mt-3.5 mb-5 text-xs text-[rgba(12,8,5,0.66)]">
                    ≈ {fmt(plan.monthlyEquiv)} {t.pricing.perMonth}
                    {plan.savingsPct ? (
                      <span className="ml-1.5 font-medium text-emerald-600">· −{plan.savingsPct}%</span>
                    ) : null}
                  </p>
                ) : null}
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[rgba(12,8,5,0.72)]">
                      <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${plan.popular ? "btn-primary" : "btn-secondary"}`}
                >
                  {loading === plan.id ? t.pricing.processing : plan.cta}
                </button>
              </Stagger.Item>
            ))}
      </Stagger.Container>

      {/* Credit Packs — pay-as-you-go alternative to subscriptions */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold text-surface-950 text-center mb-2">{t.pricing.creditPacksTitle}</h2>
        <p className="text-xs text-[rgba(12,8,5,0.66)] text-center mb-6">{t.pricing.creditPacksSubtitle}</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {creditPacks === null
            ? [0, 1, 2].map((i) => (
                <div key={i} className="surface-card p-5 animate-pulse" data-testid="credit-skeleton">
                  <div className="h-4 w-20 rounded bg-[rgba(12,8,5,0.07)] mb-3" />
                  <div className="h-8 w-24 rounded bg-[rgba(12,8,5,0.07)] mb-4" />
                  <div className="h-8 w-full rounded bg-[rgba(12,8,5,0.07)]" />
                </div>
              ))
            : creditPacks.map((pack) => (
                <div key={pack.id} className={`surface-card p-5 relative ${pack.popular ? "border-primary-500/30 ring-1 ring-primary-500/10" : ""}`}>
                  {pack.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary-600 text-[11px] font-medium text-white">
                      {t.pricing.bestValue}
                    </div>
                  )}
                  <div className="text-xs text-[rgba(12,8,5,0.72)] mb-1">{pack.credits} {t.pricing.credits}</div>
                  <div className="text-2xl font-bold text-surface-950 mb-4">{fmt(pack.price)}</div>
                  <button
                    onClick={() => router.push(`/checkout?type=credits&pack=${pack.id}`)}
                    className="w-full py-2 rounded-lg text-xs font-medium btn-secondary"
                  >
                    {t.pricing.buyNow}
                  </button>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
