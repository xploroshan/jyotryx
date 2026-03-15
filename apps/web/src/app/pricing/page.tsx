"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "",
    features: [
      "3 credits on signup",
      "10 free credits per month",
      "AI Astrologer Chat",
      "Daily Horoscope",
      "Panchang Access",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "monthly",
    name: "Premium Monthly",
    price: 499,
    period: "/month",
    features: [
      "Unlimited AI Chat",
      "Kundli Generation",
      "Kundli Matching",
      "Palmistry Analysis",
      "All Horoscopes",
      "Muhurat Finder",
      "Report Generation",
      "Priority Support",
    ],
    cta: "Subscribe Now",
    popular: true,
  },
  {
    id: "annual",
    name: "Premium Annual",
    price: 4999,
    period: "/year",
    features: [
      "Everything in Monthly",
      "Save 2 months (17% off)",
      "Exclusive Annual Reports",
      "Early access to new features",
      "Dedicated support",
    ],
    cta: "Best Value",
    popular: false,
  },
];

const creditPacks = [
  { credits: 25, price: 99, label: "Starter" },
  { credits: 75, price: 249, label: "Popular" },
  { credits: 200, price: 599, label: "Pro" },
];

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) {
      router.push("/auth?mode=signup");
      return;
    }
    if (planId === "free") {
      router.push("/chat");
      return;
    }

    setLoading(planId);
    setError("");
    try {
      const res = await api.post<{ subscriptionId: string; shortUrl?: string }>(
        "/payments/subscribe",
        { plan: planId === "monthly" ? "MONTHLY" : "ANNUAL" },
        { token: accessToken! }
      );
      if (res.shortUrl) {
        window.location.href = res.shortUrl;
      }
    } catch (err: any) {
      setError(err.message || "Failed to create subscription. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleBuyCredits = async (credits: number, price: number) => {
    if (!isAuthenticated) {
      router.push("/auth?mode=signup");
      return;
    }

    setLoading(`credits-${credits}`);
    setError("");
    try {
      const res = await api.post<{ orderId: string; amount: number }>(
        "/payments/create-order",
        { amount: price, type: "CREDITS", metadata: { credits } },
        { token: accessToken! }
      );
      // In production, this would open Razorpay checkout
      alert(`Order created: ${res.orderId}. Razorpay checkout would open here.`);
    } catch (err: any) {
      setError(err.message || "Failed to create order. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-mystic-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">💎</span>
            Plans & Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            Choose Your <span className="text-gradient">Cosmic Plan</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Unlock unlimited access to AI-powered astrology insights.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center max-w-lg mx-auto">
            {error}
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`glass-card p-8 relative ${plan.popular ? "border-primary-500/50 ring-1 ring-primary-500/20" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary-600 to-mystic-600 text-xs font-bold text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-display font-bold text-white mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                {plan.price > 0 ? (
                  <>
                    <span className="text-4xl font-bold text-gradient">{formatCurrency(plan.price)}</span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </>
                ) : (
                  <span className="text-4xl font-bold text-gradient">Free</span>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
                  plan.popular
                    ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white hover:from-primary-500 hover:to-mystic-500"
                    : "glass text-white hover:bg-white/10"
                }`}
              >
                {loading === plan.id ? "Processing..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Credit Packs */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-display font-bold mb-2">
            Or Buy <span className="text-gradient">Credit Packs</span>
          </h2>
          <p className="text-gray-400 text-sm">Pay as you go with credit packs</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
          {creditPacks.map((pack) => (
            <div key={pack.credits} className="glass-card p-6 text-center">
              <p className="text-xs text-gray-500 mb-1">{pack.label}</p>
              <p className="text-3xl font-bold text-gradient mb-1">{pack.credits}</p>
              <p className="text-xs text-gray-500 mb-4">credits</p>
              <p className="text-lg font-bold text-white mb-4">{formatCurrency(pack.price)}</p>
              <button
                onClick={() => handleBuyCredits(pack.credits, pack.price)}
                disabled={loading === `credits-${pack.credits}`}
                className="w-full py-2.5 rounded-xl glass text-sm text-primary-400 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {loading === `credits-${pack.credits}` ? "Processing..." : "Buy Now"}
              </button>
            </div>
          ))}
        </div>

        {/* Credit Usage Info */}
        <div className="glass-card p-6 max-w-3xl mx-auto">
          <h3 className="font-display font-bold text-white mb-4">Credit Usage</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { action: "AI Chat Question", cost: "1 credit" },
              { action: "Kundli Generation", cost: "2 credits" },
              { action: "Palmistry Analysis", cost: "3 credits" },
              { action: "Report Generation", cost: "5 credits" },
            ].map((item) => (
              <div key={item.action} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <span className="text-sm text-gray-300">{item.action}</span>
                <span className="text-sm font-medium text-accent-400">{item.cost}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
