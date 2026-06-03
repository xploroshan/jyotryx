"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, statusBadge, formatCurrency, formatDate } from "./components/helpers";
import { Toast } from "@/components/ui/Toast";

// ─── Lazy-loaded tab components ──────────────────────────────────────────────

const DashboardTab = dynamic(() => import("./components/DashboardTab").then(m => ({ default: m.DashboardTab })), { ssr: false });
const UsersTab = dynamic(() => import("./components/UsersTab").then(m => ({ default: m.UsersTab })), { ssr: false });
const ActivityTab = dynamic(() => import("./components/ActivityTab").then(m => ({ default: m.ActivityTab })), { ssr: false });
const AnalyticsTab = dynamic(() => import("./components/AnalyticsTab").then(m => ({ default: m.AnalyticsTab })), { ssr: false });
const LlmTab = dynamic(() => import("./components/LlmTab").then(m => ({ default: m.LlmTab })), { ssr: false });
const ContentTab = dynamic(() => import("./components/ContentTab").then(m => ({ default: m.ContentTab })), { ssr: false });
const CostTab = dynamic(() => import("./components/CostTab").then(m => ({ default: m.CostTab })), { ssr: false });
const FunnelTab = dynamic(() => import("./components/FunnelTab").then(m => ({ default: m.FunnelTab })), { ssr: false });
const OpsTab = dynamic(() => import("./components/OpsTab").then(m => ({ default: m.OpsTab })), { ssr: false });
const SafetyTab = dynamic(() => import("./components/SafetyTab").then(m => ({ default: m.SafetyTab })), { ssr: false });
const GdprTab = dynamic(() => import("./components/GdprTab").then(m => ({ default: m.GdprTab })), { ssr: false });
const ReferralTab = dynamic(() => import("./components/ReferralTab").then(m => ({ default: m.ReferralTab })), { ssr: false });
const MonetizationTab = dynamic(() => import("./components/MonetizationTab").then(m => ({ default: m.MonetizationTab })), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────��──

type TabId = "dashboard" | "users" | "payments" | "chats" | "analytics" | "ai" | "content" | "activity" | "pricing" | "cost" | "funnel" | "ops" | "safety" | "gdpr" | "referral" | "monetization";

// ─── Main Admin Page ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated } = useAuthStore();
  // Wait for the persisted auth state to rehydrate before redirecting.
  // Without this gate, the first render sees `isAuthenticated: false`,
  // pushes to /auth, and an authenticated admin gets bounced to /my-day
  // by /auth's own redirect — making /admin unreachable on hard refresh.
  const isHydrated = useAuthHydrated();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  // Inline tabs state (payments, chats, pricing — small enough to stay inline)
  const [payments, setPayments] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Pricing state
  const [pricingMonthly, setPricingMonthly] = useState("499");
  const [pricingAnnual, setPricingAnnual] = useState("4999");
  const [creditStarterCredits, setCreditStarterCredits] = useState("25");
  const [creditStarterPrice, setCreditStarterPrice] = useState("99");
  const [creditPopularCredits, setCreditPopularCredits] = useState("75");
  const [creditPopularPrice, setCreditPopularPrice] = useState("249");
  const [creditProCredits, setCreditProCredits] = useState("200");
  const [creditProPrice, setCreditProPrice] = useState("599");
  const [pricingSaving, setPricingSaving] = useState(false);

  // Monetization mode + one-time pricing (stored as feature.* / pricing.* /
  // social.* SiteSettings). Booleans are stored as "true"/"false" strings.
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
  const [pricingPageEnabled, setPricingPageEnabled] = useState(false);
  const [reportPrice, setReportPrice] = useState("199");
  const [palmistryPrice, setPalmistryPrice] = useState("250");
  const [socialReportBase, setSocialReportBase] = useState("41345");

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated || user?.role !== "ADMIN") {
      router.push("/auth");
      return;
    }
    loadInlineData();
  }, [isHydrated, isAuthenticated, user, activeTab]);

  const loadInlineData = async () => {
    if (!accessToken) return;
    if (!["payments", "chats", "pricing"].includes(activeTab)) return;

    setLoading(true);
    setError("");
    try {
      if (activeTab === "payments") {
        const paymentsRes = await api.get<any[]>("/admin/payments", { token: accessToken });
        setPayments(paymentsRes);
      } else if (activeTab === "chats") {
        const chatsRes = await api.get<any[]>("/admin/chats", { token: accessToken });
        setChats(chatsRes);
      } else if (activeTab === "pricing") {
        const settings = await api.get<Record<string, string>>("/admin/settings?prefix=pricing.", { token: accessToken });
        if (settings["pricing.monthly.price"]) setPricingMonthly(settings["pricing.monthly.price"]);
        if (settings["pricing.annual.price"]) setPricingAnnual(settings["pricing.annual.price"]);
        if (settings["pricing.credits.starter.credits"]) setCreditStarterCredits(settings["pricing.credits.starter.credits"]);
        if (settings["pricing.credits.starter.price"]) setCreditStarterPrice(settings["pricing.credits.starter.price"]);
        if (settings["pricing.credits.popular.credits"]) setCreditPopularCredits(settings["pricing.credits.popular.credits"]);
        if (settings["pricing.credits.popular.price"]) setCreditPopularPrice(settings["pricing.credits.popular.price"]);
        if (settings["pricing.credits.pro.credits"]) setCreditProCredits(settings["pricing.credits.pro.credits"]);
        if (settings["pricing.credits.pro.price"]) setCreditProPrice(settings["pricing.credits.pro.price"]);
        if (settings["pricing.report.price"]) setReportPrice(settings["pricing.report.price"]);
        if (settings["pricing.palmistry.price"]) setPalmistryPrice(settings["pricing.palmistry.price"]);
        // Mode flags + social seed live under the feature./social. prefixes.
        const flags = await api.get<Record<string, string>>("/admin/settings?prefix=feature.", { token: accessToken });
        setSubscriptionsEnabled(flags["feature.subscriptions_enabled"] === "true");
        setPricingPageEnabled(flags["feature.pricing_page_enabled"] === "true");
        const social = await api.get<Record<string, string>>("/admin/settings?prefix=social.", { token: accessToken });
        if (social["social.report_count_base"]) setSocialReportBase(social["social.report_count_base"]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "\uD83D\uDCCA" },
    { id: "funnel", label: "Funnel", icon: "\uD83C\uDFAF" },
    { id: "ops", label: "Ops", icon: "\u2699\uFE0F" },
    { id: "safety", label: "Safety", icon: "\uD83D\uDEE1\uFE0F" },
    { id: "gdpr", label: "GDPR", icon: "\uD83D\uDCDC" },
    { id: "cost", label: "Cost", icon: "\uD83D\uDCB8" },
    { id: "users", label: "Users", icon: "\uD83D\uDC65" },
    { id: "activity", label: "Activity", icon: "\uD83D\uDDD3" },
    { id: "payments", label: "Payments", icon: "\uD83D\uDCB3" },
    { id: "chats", label: "Chats", icon: "\uD83D\uDCAC" },
    { id: "analytics", label: "Analytics", icon: "\uD83D\uDCC8" },
    { id: "pricing", label: "Pricing", icon: "\uD83D\uDCB0" },
    { id: "ai", label: "AI Agents", icon: "\uD83E\uDD16" },
    { id: "content", label: "Content", icon: "\uD83D\uDCDD" },
    { id: "referral", label: "Referrals", icon: "\uD83C\uDF81" },
    { id: "monetization", label: "Monetize", icon: "\uD83D\uDCB0" },
  ];

  if (!isHydrated || !isAuthenticated || user?.role !== "ADMIN") return null;

  return (
    <div className="relative min-h-screen">
      
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Admin Dashboard</h1>
            <p className="text-ink-500 text-sm mt-1">Manage your myastro360 platform</p>
          </div>
          <div className="surface-card px-4 py-2 rounded-xl text-sm text-ink-700">
            Logged in as <span className="text-primary-400 font-medium">{user?.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-black/[0.04] p-1 w-fit overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? "btn-primary text-white" : "text-ink-500 hover:text-ink-900"}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Messages — routed through the shared Toast primitive so
            every admin surface speaks the same feedback language and
            the banner stays dismissable instead of auto-disappearing
            after a fixed timeout the user can miss. */}
        {error && (
          <div className="mb-6">
            <Toast message={error} tone="error" onClose={() => setError("")} />
          </div>
        )}
        {success && (
          <div className="mb-6">
            <Toast message={success} tone="success" onClose={() => setSuccess("")} autoCloseMs={4000} />
          </div>
        )}

        {/* Dynamic tab components */}
        {activeTab === "dashboard" && accessToken && (
          <DashboardTab token={accessToken} onTabChange={(tab) => setActiveTab(tab as TabId)} />
        )}

        {activeTab === "cost" && accessToken && (
          <CostTab token={accessToken} />
        )}

        {activeTab === "funnel" && accessToken && (
          <FunnelTab token={accessToken} />
        )}

        {activeTab === "ops" && accessToken && (
          <OpsTab token={accessToken} />
        )}

        {activeTab === "safety" && accessToken && (
          <SafetyTab token={accessToken} />
        )}

        {activeTab === "gdpr" && accessToken && (
          <GdprTab token={accessToken} />
        )}

        {activeTab === "users" && accessToken && (
          <UsersTab token={accessToken} />
        )}

        {activeTab === "activity" && accessToken && (
          <ActivityTab token={accessToken} />
        )}

        {activeTab === "analytics" && accessToken && (
          <AnalyticsTab token={accessToken} />
        )}

        {activeTab === "ai" && accessToken && (
          <LlmTab token={accessToken} />
        )}

        {activeTab === "content" && accessToken && (
          <ContentTab token={accessToken} />
        )}

        {activeTab === "referral" && accessToken && (
          <ReferralTab token={accessToken} />
        )}

        {activeTab === "monetization" && accessToken && (
          <MonetizationTab token={accessToken} />
        )}

        {/* Inline tabs — small enough to stay in the main bundle */}
        {loading && ["payments", "chats", "pricing"].includes(activeTab) && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && activeTab === "payments" && (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.10]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-b border-black/5 hover:bg-black/[0.04]">
                      <td className="px-4 py-3 text-ink-900">{p.userName}<br /><span className="text-xs text-ink-500">{p.userEmail}</span></td>
                      <td className="px-4 py-3 text-ink-700">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3">{statusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-ink-500">{p.type}</td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">No payments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && activeTab === "chats" && (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.10]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Messages</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {chats.map((c: any) => (
                    <tr key={c.id} className="border-b border-black/5 hover:bg-black/[0.04]">
                      <td className="px-4 py-3 text-ink-900">{c.userName}<br /><span className="text-xs text-ink-500">{c.userEmail}</span></td>
                      <td className="px-4 py-3 text-ink-700">{c.title}</td>
                      <td className="px-4 py-3"><Badge>{c.category}</Badge></td>
                      <td className="px-4 py-3 text-ink-700">{c.messageCount}</td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{formatDate(c.updatedAt)}</td>
                    </tr>
                  ))}
                  {chats.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">No chats yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && activeTab === "pricing" && (
          <div>
            <h2 className="text-xl font-bold text-gradient mb-6">Pricing Management</h2>

            {/* ── Monetization mode ───────────────────────────────────── */}
            <h3 className="text-lg font-bold text-ink-900 mb-4">Monetization Mode</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div className="surface-card p-6 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-ink-900 mb-1">Subscriptions enabled</h4>
                  <p className="text-xs text-ink-500">
                    Off = whole app free except Chat, Palmistry &amp; Reports (pay-per-use).
                    On = paid subscribers get everything free.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={subscriptionsEnabled}
                  onClick={() => setSubscriptionsEnabled((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${subscriptionsEnabled ? "bg-emerald-500" : "bg-black/20"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${subscriptionsEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <div className="surface-card p-6 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-ink-900 mb-1">Show pricing page</h4>
                  <p className="text-xs text-ink-500">
                    Off = hide /pricing, nav &amp; footer links and show the &ldquo;Free&rdquo; hero.
                    Turn on once you&apos;re ready to sell subscriptions.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pricingPageEnabled}
                  onClick={() => setPricingPageEnabled((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${pricingPageEnabled ? "bg-emerald-500" : "bg-black/20"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${pricingPageEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>

            {/* ── One-time unlock prices ──────────────────────────────── */}
            <h3 className="text-lg font-bold text-ink-900 mb-4">One-time Unlocks</h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Report price</h4>
                <label className="block text-xs text-ink-500 mb-2">Price (INR)</label>
                <input type="number" value={reportPrice} onChange={(e) => setReportPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Palmistry price</h4>
                <label className="block text-xs text-ink-500 mb-2">Price (INR)</label>
                <input type="number" value={palmistryPrice} onChange={(e) => setPalmistryPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Report counter seed</h4>
                <label className="block text-xs text-ink-500 mb-2">Base &ldquo;reports delivered&rdquo;</label>
                <input type="number" value={socialReportBase} onChange={(e) => setSocialReportBase(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-ink-900 mb-4">Subscription Plans</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Premium Monthly</h4>
                <label className="block text-xs text-ink-500 mb-2">Price (INR)</label>
                <input type="number" value={pricingMonthly} onChange={(e) => setPricingMonthly(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Premium Annual</h4>
                <label className="block text-xs text-ink-500 mb-2">Price (INR)</label>
                <input type="number" value={pricingAnnual} onChange={(e) => setPricingAnnual(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-ink-900 mb-4">Credit Packs</h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Starter Pack</h4>
                <label className="block text-xs text-ink-500 mb-2">Credits</label>
                <input type="number" value={creditStarterCredits} onChange={(e) => setCreditStarterCredits(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm mb-3" />
                <label className="block text-xs text-ink-500 mb-2">Price (INR)</label>
                <input type="number" value={creditStarterPrice} onChange={(e) => setCreditStarterPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Popular Pack</h4>
                <label className="block text-xs text-ink-500 mb-2">Credits</label>
                <input type="number" value={creditPopularCredits} onChange={(e) => setCreditPopularCredits(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm mb-3" />
                <label className="block text-xs text-ink-500 mb-2">Price (INR)</label>
                <input type="number" value={creditPopularPrice} onChange={(e) => setCreditPopularPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
              <div className="surface-card p-6">
                <h4 className="font-bold text-ink-900 mb-4">Pro Pack</h4>
                <label className="block text-xs text-ink-500 mb-2">Credits</label>
                <input type="number" value={creditProCredits} onChange={(e) => setCreditProCredits(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm mb-3" />
                <label className="block text-xs text-ink-500 mb-2">Price (INR)</label>
                <input type="number" value={creditProPrice} onChange={(e) => setCreditProPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm" />
              </div>
            </div>

            <button
              disabled={pricingSaving}
              onClick={async () => {
                setPricingSaving(true);
                setError("");
                try {
                  await api.put("/admin/settings", {
                    "pricing.monthly.price": pricingMonthly,
                    "pricing.annual.price": pricingAnnual,
                    "pricing.credits.starter.credits": creditStarterCredits,
                    "pricing.credits.starter.price": creditStarterPrice,
                    "pricing.credits.popular.credits": creditPopularCredits,
                    "pricing.credits.popular.price": creditPopularPrice,
                    "pricing.credits.pro.credits": creditProCredits,
                    "pricing.credits.pro.price": creditProPrice,
                    "pricing.report.price": reportPrice,
                    "pricing.palmistry.price": palmistryPrice,
                    "feature.subscriptions_enabled": subscriptionsEnabled ? "true" : "false",
                    "feature.pricing_page_enabled": pricingPageEnabled ? "true" : "false",
                    "social.report_count_base": socialReportBase,
                  }, { token: accessToken! });
                  setSuccess("Pricing updated successfully");
                  setTimeout(() => setSuccess(""), 3000);
                } catch (err: any) {
                  setError(err.message || "Failed to update pricing");
                } finally {
                  setPricingSaving(false);
                }
              }}
              className="px-6 py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
            >
              {pricingSaving ? "Saving..." : "Save Pricing"}
            </button>
            <p className="text-xs text-ink-500 mt-3">Changes are applied immediately to the pricing page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
