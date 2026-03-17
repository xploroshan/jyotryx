"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

const defaultPlans = [
  {
    id: "free", name: "Free", price: 0, period: "",
    features: ["3 credits on signup", "10 free credits per month", "Astrologer Chat", "Daily Horoscope", "Panchang Access"],
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

const defaultCreditPacks = [
  { credits: 25, price: 99, label: "Starter" },
  { credits: 75, price: 249, label: "Popular" },
  { credits: 200, price: 599, label: "Pro" },
];

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState(defaultPlans);
  const [creditPacks, setCreditPacks] = useState(defaultCreditPacks);

  useEffect(() => {
    api.get<Record<string, string>>("/payments/pricing").then((settings) => {
      const monthlyPrice = parseInt(settings["pricing.monthly.price"]) || 499;
      const annualPrice = parseInt(settings["pricing.annual.price"]) || 4999;
      setPlans((prev) => prev.map((p) => {
        if (p.id === "monthly") return { ...p, price: monthlyPrice };
        if (p.id === "annual") return { ...p, price: annualPrice };
        return p;
      }));
      setCreditPacks([
        { credits: parseInt(settings["pricing.credits.starter.credits"]) || 25, price: parseInt(settings["pricing.credits.starter.price"]) || 99, label: "Starter" },
        { credits: parseInt(settings["pricing.credits.popular.credits"]) || 75, price: parseInt(settings["pricing.credits.popular.price"]) || 249, label: "Popular" },
        { credits: parseInt(settings["pricing.credits.pro.credits"]) || 200, price: parseInt(settings["pricing.credits.pro.price"]) || 599, label: "Pro" },
      ]);
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

  const handleBuyCredits = async (credits: number, price: number) => {
    if (!isAuthenticated) { router.push("/auth?mode=signup"); return; }
    setLoading(`credits-${credits}`); setError("");
    try {
      const res = await api.post<{ orderId: string; amount: number }>("/payments/create-order", { amount: price, type: "CREDITS", metadata: { credits } }, { token: accessToken! });
      alert(`Order created: ${res.orderId}. Razorpay checkout would open here.`);
    } catch (err: any) { setError(err.message || "Failed to create order."); }
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
      <div className="grid md:grid-cols-3 gap-4 mb-16">
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

      {/* Credit Packs */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-1">
          Credit <span className="text-gradient">packs</span>
        </h2>
        <p className="text-xs text-white/30">Pay as you go</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-10">
        {creditPacks.map((pack) => (
          <div key={pack.label} className="surface-card p-5 text-center">
            <p className="text-[11px] text-white/25 mb-1">{pack.label}</p>
            <p className="text-2xl font-bold text-white mb-0.5">{pack.credits}</p>
            <p className="text-[11px] text-white/25 mb-3">credits</p>
            <p className="text-sm font-semibold text-white mb-3">{fmt(pack.price)}</p>
            <button
              onClick={() => handleBuyCredits(pack.credits, pack.price)}
              disabled={loading === `credits-${pack.credits}`}
              className="w-full py-2 rounded-lg btn-secondary text-xs disabled:opacity-50"
            >
              {loading === `credits-${pack.credits}` ? "Processing..." : "Buy Now"}
            </button>
          </div>
        ))}
      </div>

      {/* Usage Info */}
      <div className="surface-card p-5 max-w-2xl mx-auto">
        <h3 className="text-sm font-semibold text-white mb-3">Credit Usage</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { action: "Chat Question", cost: "1 credit" },
            { action: "Kundli Generation", cost: "2 credits" },
            { action: "Palmistry Analysis", cost: "3 credits" },
            { action: "Report Generation", cost: "5 credits" },
          ].map((item) => (
            <div key={item.action} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03]">
              <span className="text-xs text-white/40">{item.action}</span>
              <span className="text-xs font-medium text-accent-400">{item.cost}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
