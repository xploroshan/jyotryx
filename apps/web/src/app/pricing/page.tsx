"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

const defaultPlans = [
  {
    id: "free", name: "Free", price: 0, period: "",
    features: ["Limited consultations", "Astrologer Chat", "Daily Horoscope", "Panchang Access"],
    cta: "Get Started", popular: false,
  },
  {
    id: "monthly", name: "Premium", price: 499, period: "/month",
    features: ["Unlimited Chat", "Kundli Generation", "Kundli Matching", "Palmistry Analysis", "All Horoscopes", "Muhurat Finder", "Report Generation", "Priority Support"],
    cta: "Subscribe", popular: true,
  },
  {
    id: "annual", name: "Annual", price: 4999, period: "/year",
    features: ["Everything in Premium", "Save 17% (2 months free)", "Exclusive Annual Reports", "Early access to features", "Dedicated support"],
    cta: "Best Value", popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState(defaultPlans);

  useEffect(() => {
    api.get<Record<string, string>>("/payments/pricing").then((settings) => {
      const monthlyPrice = parseInt(settings["pricing.monthly.price"]) || 499;
      const annualPrice = parseInt(settings["pricing.annual.price"]) || 4999;
      setPlans((prev) => prev.map((p) => {
        if (p.id === "monthly") return { ...p, price: monthlyPrice };
        if (p.id === "annual") return { ...p, price: annualPrice };
        return p;
      }));
    }).catch(() => {});
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) { router.push("/auth?mode=signup"); return; }
    if (planId === "free") { router.push("/chat"); return; }
    setLoading(planId); setError("");
    try {
      const res = await api.post<{ subscriptionId: string; shortUrl?: string }>("/payments/subscribe", { plan: planId === "monthly" ? "MONTHLY" : "ANNUAL" }, { token: accessToken! });
      if (res.shortUrl) window.location.href = res.shortUrl;
    } catch (err: any) { setError(err.message || "Failed to create subscription."); }
    finally { setLoading(null); }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
          Simple, transparent <span className="text-gradient">pricing</span>
        </h1>
        <p className="text-sm text-white/40 max-w-md mx-auto">
          Unlock unlimited access to Vedic astrology insights.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center max-w-md mx-auto">{error}</div>
      )}

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`surface-card p-6 relative ${plan.popular ? "border-primary-500/30 ring-1 ring-primary-500/10" : ""}`}>
            {plan.popular && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary-600 text-[11px] font-medium text-white">
                Most Popular
              </div>
            )}
            <h3 className="text-sm font-semibold text-white mb-1">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-5">
              {plan.price > 0 ? (
                <>
                  <span className="text-3xl font-bold text-white">{fmt(plan.price)}</span>
                  <span className="text-xs text-white/30">{plan.period}</span>
                </>
              ) : (
                <span className="text-3xl font-bold text-white">Free</span>
              )}
            </div>
            <ul className="space-y-2.5 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-white/50">
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
              {loading === plan.id ? "Processing..." : plan.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
