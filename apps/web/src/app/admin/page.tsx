"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  totalChats: number;
  totalKundlis: number;
  totalPayments: number;
  newUsersToday: number;
  activeSubscriptions: number;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  credits: number;
  provider: string;
  createdAt: string;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  credits: number;
  provider: string;
  gender: string | null;
  dateOfBirth: string | null;
  timeOfBirth: string | null;
  placeOfBirth: any;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
  subscriptions: Array<{
    id: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string | null;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
    createdAt: string;
  }>;
  recentChats: Array<{
    id: string;
    title: string;
    category: string;
    messageCount: number;
    updatedAt: string;
  }>;
  creditTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string | null;
    createdAt: string;
  }>;
  reports: Array<{
    id: string;
    type: string;
    status: string;
    price: number;
    createdAt: string;
  }>;
  stats: {
    totalChats: number;
    totalPayments: number;
    totalSpent: number;
    totalCreditsUsed: number;
    kundliCharts: number;
    palmistryReadings: number;
    matchingResults: number;
  };
}

interface PlatformAnalytics {
  sessionsToday: number;
  sessionsLast7Days: number;
  avgSessionsPerDay: number;
  avgChatLength: number;
  creditsConsumedToday: number;
  creditsConsumedLast7Days: number;
  revenueTrend: Array<{ date: string; revenue: number }>;
  featureUsage: Array<{ feature: string; count: number; percent: number }>;
  conversionRate: number;
  retention: { day1: number; day7: number; day30: number };
  llmTotals: {
    callsLast7Days: number;
    totalCostUsdLast7Days: number;
    totalTokensLast7Days: number;
  };
}

interface LlmCostRow {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  calls: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface ContentStats {
  knowledgeDocuments: number;
  knowledgeCategories: Array<{ category: string; count: number }>;
  tarotReadings: number;
  kundliCharts: number;
  reports: number;
  palmistryReadings: number;
  matchingResults: number;
  chatSessions: number;
  notifications: number;
}

interface ActivityLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  previousData: any;
  newData: any;
  undone: boolean;
  undoneAt: string | null;
  createdAt: string;
}

type TabId = "dashboard" | "users" | "payments" | "chats" | "analytics" | "ai" | "content" | "activity" | "pricing";

// ─── Helper Components ────────────────────────────────────────────────────────

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "purple" | "blue" }) {
  const colors = {
    default: "bg-white/[0.03] text-white/40",
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/20 text-amber-400",
    danger: "bg-red-500/20 text-red-400",
    purple: "bg-purple-500/20 text-purple-400",
    blue: "bg-blue-500/20 text-blue-400",
  };
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[variant]}`}>{children}</span>;
}

function roleBadge(role: string) {
  if (role === "ADMIN") return <Badge variant="danger">{role}</Badge>;
  if (role === "PREMIUM") return <Badge variant="purple">{role}</Badge>;
  return <Badge>{role}</Badge>;
}

function statusBadge(status: string) {
  if (status === "ACTIVE" || status === "SUCCESS" || status === "READY") return <Badge variant="success">{status}</Badge>;
  if (status === "PENDING" || status === "GENERATING") return <Badge variant="warning">{status}</Badge>;
  if (status === "CANCELLED" || status === "FAILED" || status === "EXPIRED") return <Badge variant="danger">{status}</Badge>;
  return <Badge>{status}</Badge>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: UserDetail;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    credits: user.credits,
    gender: user.gender || "",
    preferredLanguage: user.preferredLanguage,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      role: form.role,
      credits: Number(form.credits),
      gender: form.gender || null,
      preferredLanguage: form.preferredLanguage,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="surface-card w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Edit User</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/30 mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/30 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-white/30 mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm focus:outline-none focus:border-primary-500">
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/30 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm focus:outline-none focus:border-primary-500">
                <option value="USER">User</option>
                <option value="PREMIUM">Premium</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/30 mb-1">Credits</label>
              <input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-1">Language</label>
            <select value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm focus:outline-none focus:border-primary-500">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="bn">Bengali</option>
              <option value="mr">Marathi</option>
              <option value="gu">Gujarati</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl btn-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl surface-card text-sm text-white/60 hover:bg-white/10">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── User Detail Panel ────────────────────────────────────────────────────────

function UserDetailPanel({
  userId,
  token,
  onClose,
  onEdit,
  onDelete,
  onCancelSubscription,
}: {
  userId: string;
  token: string;
  onClose: () => void;
  onEdit: (user: UserDetail) => void;
  onDelete: (userId: string) => void;
  onCancelSubscription: (subId: string) => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<"overview" | "subscriptions" | "payments" | "chats" | "credits" | "reports">("overview");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<UserDetail>(`/admin/users/${userId}`, { token });
        setDetail(data);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, token]);

  if (loading) {
    return (
      <div className="surface-card p-8 flex items-center justify-center">
        <svg className="w-6 h-6 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!detail) return <div className="surface-card p-6 text-red-400 text-sm">Failed to load user details.</div>;

  const detailTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "subscriptions" as const, label: `Subscriptions (${detail.subscriptions.length})` },
    { id: "payments" as const, label: `Payments (${detail.recentPayments.length})` },
    { id: "chats" as const, label: `Chats (${detail.recentChats.length})` },
    { id: "credits" as const, label: `Credits (${detail.creditTransactions.length})` },
    { id: "reports" as const, label: `Reports (${detail.reports.length})` },
  ];

  return (
    <div className="surface-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-xl font-bold text-white">{detail.name}</h3>
              {roleBadge(detail.role)}
            </div>
            <p className="text-sm text-white/40">{detail.email}</p>
            {detail.phone && <p className="text-sm text-white/30">{detail.phone}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(detail)} className="px-3 py-1.5 rounded-lg surface-card text-xs text-primary-400 hover:bg-white/10">Edit</button>
            <button onClick={() => onDelete(detail.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20">Delete</button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/40 hover:bg-white/10">&times; Close</button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mt-4">
          {[
            { label: "Credits", value: detail.credits, color: "text-primary-400" },
            { label: "Chats", value: detail.stats.totalChats, color: "text-blue-400" },
            { label: "Payments", value: detail.stats.totalPayments, color: "text-emerald-400" },
            { label: "Spent", value: formatCurrency(detail.stats.totalSpent), color: "text-emerald-400" },
            { label: "Credits Used", value: detail.stats.totalCreditsUsed, color: "text-amber-400" },
            { label: "Kundlis", value: detail.stats.kundliCharts, color: "text-mystic-400" },
            { label: "Matchings", value: detail.stats.matchingResults, color: "text-pink-400" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-white/30">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
        {detailTabs.map((t) => (
          <button key={t.id} onClick={() => setDetailTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${detailTab === t.id ? "bg-primary-600/30 text-primary-400" : "text-white/30 hover:text-white/60"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {detailTab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Provider", value: detail.provider },
              { label: "Gender", value: detail.gender || "Not set" },
              { label: "Date of Birth", value: detail.dateOfBirth ? formatDate(detail.dateOfBirth) : "Not set" },
              { label: "Time of Birth", value: detail.timeOfBirth || "Not set" },
              { label: "Place of Birth", value: detail.placeOfBirth?.name || "Not set" },
              { label: "Language", value: detail.preferredLanguage.toUpperCase() },
              { label: "Joined", value: formatDateTime(detail.createdAt) },
              { label: "Last Updated", value: formatDateTime(detail.updatedAt) },
            ].map((item) => (
              <div key={item.label} className="flex justify-between p-3 rounded-lg bg-white/[0.03]">
                <span className="text-xs text-white/30">{item.label}</span>
                <span className="text-sm text-white/60">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {detailTab === "subscriptions" && (
          <div className="space-y-3">
            {detail.subscriptions.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No subscriptions</p>
            ) : (
              detail.subscriptions.map((sub) => (
                <div key={sub.id} className="p-4 rounded-lg bg-white/[0.03] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{sub.plan} Plan</span>
                      {statusBadge(sub.status)}
                    </div>
                    <p className="text-xs text-white/30">
                      {formatDate(sub.startDate)} {sub.endDate ? ` - ${formatDate(sub.endDate)}` : " - Ongoing"}
                    </p>
                  </div>
                  {sub.status === "ACTIVE" && (
                    <button onClick={() => onCancelSubscription(sub.id)}
                      className="px-3 py-1 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20">
                      Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === "payments" && (
          <div className="overflow-x-auto">
            {detail.recentPayments.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No payments</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2 text-xs text-white/30">Amount</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Status</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Type</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="px-3 py-2 text-white">{formatCurrency(p.amount)}</td>
                      <td className="px-3 py-2">{statusBadge(p.status)}</td>
                      <td className="px-3 py-2 text-white/40">{p.type}</td>
                      <td className="px-3 py-2 text-white/30 text-xs">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === "chats" && (
          <div className="space-y-2">
            {detail.recentChats.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No chat sessions</p>
            ) : (
              detail.recentChats.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-white/[0.03] flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{c.title}</p>
                    <p className="text-xs text-white/30">{c.category} &middot; {c.messageCount} messages</p>
                  </div>
                  <span className="text-xs text-white/30">{formatDate(c.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === "credits" && (
          <div className="overflow-x-auto">
            {detail.creditTransactions.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No credit transactions</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2 text-xs text-white/30">Amount</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Type</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Description</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.creditTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className={`px-3 py-2 font-medium ${t.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.amount > 0 ? "+" : ""}{t.amount}
                      </td>
                      <td className="px-3 py-2 text-white/40">{t.type.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-white/30 text-xs">{t.description || "-"}</td>
                      <td className="px-3 py-2 text-white/30 text-xs">{formatDateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === "reports" && (
          <div className="space-y-2">
            {detail.reports.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No reports generated</p>
            ) : (
              detail.reports.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-white/[0.03] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{r.type} Report</span>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-xs text-white/30">{formatCurrency(r.price)}</p>
                  </div>
                  <span className="text-xs text-white/30">{formatDate(r.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Log Component ───────────────────────────────────────────────────

function ActivityTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [undoing, setUndoing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (actionFilter) params.set("action", actionFilter);
      const res = await api.get<{ logs: ActivityLog[]; total: number }>(`/admin/activity?${params}`, { token });
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, actionFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleUndo = async (logId: string) => {
    if (!confirm("Are you sure you want to undo this action? This will revert the changes.")) return;
    setUndoing(logId);
    setMessage(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>(`/admin/activity/${logId}/undo`, {}, { token });
      setMessage({ type: "success", text: res.message });
      loadLogs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to undo" });
    } finally {
      setUndoing(null);
    }
  };

  const actionLabels: Record<string, string> = {
    USER_UPDATE: "User Updated",
    USER_DELETE: "User Deleted",
    USER_CREDITS_UPDATE: "Credits Changed",
    USER_ROLE_CHANGE: "Role Changed",
    SUBSCRIPTION_CANCEL: "Subscription Cancelled",
    SUBSCRIPTION_UPDATE: "Subscription Updated",
  };

  const actionColors: Record<string, string> = {
    USER_UPDATE: "text-blue-400 bg-blue-500/10",
    USER_DELETE: "text-red-400 bg-red-500/10",
    USER_CREDITS_UPDATE: "text-amber-400 bg-amber-500/10",
    USER_ROLE_CHANGE: "text-purple-400 bg-purple-500/10",
    SUBSCRIPTION_CANCEL: "text-red-400 bg-red-500/10",
    SUBSCRIPTION_UPDATE: "text-cyan-400 bg-cyan-500/10",
  };

  function renderChanges(prev: any, next: any) {
    if (!prev && !next) return null;
    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
    return (
      <div className="mt-2 space-y-1">
        {Array.from(allKeys).map((key) => (
          <div key={key} className="text-xs flex items-center gap-2">
            <span className="text-white/30 w-20 shrink-0">{key}:</span>
            {prev?.[key] !== undefined && (
              <span className="text-red-400 line-through">{String(prev[key])}</span>
            )}
            {next?.[key] !== undefined && (
              <>
                <span className="text-white/20">&rarr;</span>
                <span className="text-emerald-400">{String(next[key])}</span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gradient">Activity Log</h2>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm">
          <option value="">All Actions</option>
          <option value="USER_UPDATE">User Updates</option>
          <option value="USER_DELETE">User Deletions</option>
          <option value="USER_CREDITS_UPDATE">Credit Changes</option>
          <option value="USER_ROLE_CHANGE">Role Changes</option>
          <option value="SUBSCRIPTION_CANCEL">Subscription Cancellations</option>
        </select>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
          {message.text}
        </div>
      )}

      <p className="text-sm text-white/30 mb-4">{total} total actions recorded</p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : logs.length === 0 ? (
        <div className="surface-card p-8 text-center text-white/30">
          <p className="text-lg mb-2">No activity logged yet</p>
          <p className="text-sm">Admin actions like user edits, deletions, and subscription changes will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className={`surface-card p-4 ${log.undone ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || "text-white/40 bg-white/[0.03]"}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    {log.undone && <Badge variant="warning">UNDONE</Badge>}
                  </div>
                  <p className="text-sm text-white">
                    {log.entityType}: <span className="text-primary-400">{log.entityLabel || log.entityId}</span>
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    by {log.adminEmail} &middot; {formatDateTime(log.createdAt)}
                    {log.undone && log.undoneAt && <span> &middot; Undone at {formatDateTime(log.undoneAt)}</span>}
                  </p>
                  {renderChanges(log.previousData, log.newData)}
                </div>
                {!log.undone && log.action !== "USER_DELETE" && (
                  <button
                    onClick={() => handleUndo(log.id)}
                    disabled={undoing === log.id}
                    className="shrink-0 ml-4 px-3 py-1.5 rounded-lg bg-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {undoing === log.id ? "Undoing..." : "Undo"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/60 disabled:opacity-30">Prev</button>
          <span className="text-sm text-white/40">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/60 disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);

  // User detail / edit state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null);

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

  // AI / LLM state
  const [aiSettings, setAiSettings] = useState<Record<string, string>>({});
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSubTab, setAiSubTab] = useState<"providers" | "usage" | "features">("providers");

  // Analytics state
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [llmCosts, setLlmCosts] = useState<LlmCostRow[]>([]);
  const [llmCostDays, setLlmCostDays] = useState(30);

  // Content state
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "ADMIN") {
      router.push("/auth");
      return;
    }
    loadData();
  }, [isAuthenticated, user, activeTab, userPage, llmCostDays]);

  const loadData = async () => {
    if (!accessToken) return;
    if (activeTab === "activity") {
      setLoading(false);
      return;
    }
    if (activeTab === "analytics") {
      setLoading(true);
      try {
        const [a, l] = await Promise.all([
          api.get<PlatformAnalytics>("/admin/analytics", { token: accessToken }),
          api.get<LlmCostRow[]>(`/admin/analytics/llm-costs?limit=20&days=${llmCostDays}`, { token: accessToken }),
        ]);
        setAnalytics(a);
        setLlmCosts(l);
      } catch (err: any) {
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (activeTab === "content") {
      setLoading(true);
      try {
        const c = await api.get<ContentStats>("/admin/content/stats", { token: accessToken });
        setContentStats(c);
      } catch (err: any) {
        setError(err.message || "Failed to load content stats");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (activeTab === "ai") {
      setLoading(true);
      try {
        const s = await api.get<Record<string, string>>("/admin/settings?prefix=llm.", { token: accessToken! });
        setAiSettings(s);
      } catch {}
      setLoading(false);
      return;
    }
    if (activeTab === "pricing") {
      setLoading(true);
      try {
        const settings = await api.get<Record<string, string>>("/admin/settings?prefix=pricing.", { token: accessToken });
        if (settings["pricing.monthly.price"]) setPricingMonthly(settings["pricing.monthly.price"]);
        if (settings["pricing.annual.price"]) setPricingAnnual(settings["pricing.annual.price"]);
        if (settings["pricing.credits.starter.credits"]) setCreditStarterCredits(settings["pricing.credits.starter.credits"]);
        if (settings["pricing.credits.starter.price"]) setCreditStarterPrice(settings["pricing.credits.starter.price"]);
        if (settings["pricing.credits.popular.credits"]) setCreditPopularCredits(settings["pricing.credits.popular.credits"]);
        if (settings["pricing.credits.popular.price"]) setCreditPopularPrice(settings["pricing.credits.popular.price"]);
        if (settings["pricing.credits.pro.credits"]) setCreditProCredits(settings["pricing.credits.pro.credits"]);
        if (settings["pricing.credits.pro.price"]) setCreditProPrice(settings["pricing.credits.pro.price"]);
      } catch (err: any) {
        setError(err.message || "Failed to load pricing");
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError("");
    try {
      switch (activeTab) {
        case "dashboard": {
          const dashStats = await api.get<DashboardStats>("/admin/dashboard", { token: accessToken });
          setStats(dashStats);
          break;
        }
        case "users": {
          const usersRes = await api.get<{ users: UserItem[]; total: number }>(
            `/admin/users?search=${encodeURIComponent(search)}&page=${userPage}&limit=20`,
            { token: accessToken }
          );
          setUsers(usersRes.users);
          setUserTotal(usersRes.total);
          break;
        }
        case "payments": {
          const paymentsRes = await api.get<any[]>("/admin/payments", { token: accessToken });
          setPayments(paymentsRes);
          break;
        }
        case "chats": {
          const chatsRes = await api.get<any[]>("/admin/chats", { token: accessToken });
          setChats(chatsRes);
          break;
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, data: any) => {
    setError("");
    setSuccess("");
    try {
      await api.put(`/admin/users/${userId}`, data, { token: accessToken! });
      setSuccess("User updated successfully");
      setEditingUser(null);
      setSelectedUserId(null);
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user? This cannot be undone.")) return;
    setError("");
    try {
      await api.delete(`/admin/users/${userId}`, { token: accessToken! });
      setSuccess("User deleted successfully");
      setSelectedUserId(null);
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelSubscription = async (subId: string) => {
    if (!confirm("Cancel this subscription?")) return;
    try {
      await api.post(`/admin/subscriptions/${subId}/cancel`, {}, { token: accessToken! });
      setSuccess("Subscription cancelled");
      // Reload user detail
      setSelectedUserId((prev) => { const t = prev; setSelectedUserId(null); setTimeout(() => setSelectedUserId(t), 50); return prev; });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleQuickRoleChange = async (userId: string, role: string) => {
    try {
      await api.put(`/admin/users/${userId}`, { role }, { token: accessToken! });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "\uD83D\uDCCA" },
    { id: "users", label: "Users", icon: "\uD83D\uDC65" },
    { id: "activity", label: "Activity", icon: "\uD83D\uDDD3" },
    { id: "payments", label: "Payments", icon: "\uD83D\uDCB3" },
    { id: "chats", label: "Chats", icon: "\uD83D\uDCAC" },
    { id: "analytics", label: "Analytics", icon: "\uD83D\uDCC8" },
    { id: "pricing", label: "Pricing", icon: "\uD83D\uDCB0" },
    { id: "ai", label: "AI Agents", icon: "\uD83E\uDD16" },
    { id: "content", label: "Content", icon: "\uD83D\uDCDD" },
  ];

  // ── LLM Providers ──
  const llmProviders = [
    { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"], keyField: "llm.openai.key", color: "text-emerald-400" },
    { id: "anthropic", name: "Anthropic", models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-3.5-sonnet-20241022"], keyField: "llm.anthropic.key", color: "text-purple-400" },
    { id: "google", name: "Google Gemini", models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-flash", "gemini-1.5-pro"], keyField: "llm.google.key", color: "text-blue-400" },
    { id: "mistral", name: "Mistral AI", models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mixtral-8x22b"], keyField: "llm.mistral.key", color: "text-orange-400" },
    { id: "cohere", name: "Cohere", models: ["command-r-plus", "command-r", "command-light"], keyField: "llm.cohere.key", color: "text-sky-400" },
    { id: "groq", name: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"], keyField: "llm.groq.key", color: "text-red-400" },
  ];

  // ── Features that use AI ──
  const aiFeatures = [
    { id: "chat", name: "AI Chat / Consult", desc: "Interactive astrology consultations", tokensPerCall: "~800-2000", needsAI: true, suggestion: "AI Required", sugColor: "text-red-400" },
    { id: "kundli", name: "Kundli Interpretation", desc: "Chart analysis & interpretations", tokensPerCall: "~1000-1500", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
    { id: "horoscope", name: "Daily Horoscope", desc: "Daily sign-based predictions", tokensPerCall: "~500-800", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
    { id: "palmistry", name: "Palmistry Reading", desc: "Palm image analysis (needs vision)", tokensPerCall: "~1200-2000", needsAI: true, suggestion: "AI Required (Vision)", sugColor: "text-red-400" },
    { id: "matching", name: "Kundli Matching", desc: "Compatibility analysis", tokensPerCall: "~800-1200", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
    { id: "numerology", name: "Numerology", desc: "Name/number analysis", tokensPerCall: "~400-600", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
    { id: "daily_briefing", name: "My Day Briefing", desc: "Daily personalized predictions", tokensPerCall: "~600-1000", needsAI: false, suggestion: "KB + Rules", sugColor: "text-emerald-400" },
    { id: "reports", name: "Report Generation", desc: "Detailed PDF reports (Life, Career, etc.)", tokensPerCall: "~2000-4000", needsAI: true, suggestion: "AI Recommended", sugColor: "text-amber-400" },
    { id: "remedy", name: "Remedy Suggestions", desc: "Gemstones, mantras, remedies", tokensPerCall: "~400-600", needsAI: false, suggestion: "KB Sufficient", sugColor: "text-emerald-400" },
    { id: "panchang", name: "Panchang", desc: "Daily Hindu calendar data", tokensPerCall: "0", needsAI: false, suggestion: "No AI Needed", sugColor: "text-emerald-400" },
    { id: "muhurat", name: "Muhurat", desc: "Auspicious timing calculations", tokensPerCall: "0", needsAI: false, suggestion: "No AI Needed", sugColor: "text-emerald-400" },
  ];

  const getAiSetting = (key: string, fallback: string = "") => aiSettings[key] || fallback;
  const setAiSetting = (key: string, value: string) => setAiSettings(prev => ({ ...prev, [key]: value }));

  const saveAiSettings = async () => {
    setAiSaving(true);
    setError("");
    try {
      const updated = await api.put<Record<string, string>>("/admin/settings", aiSettings, { token: accessToken! });
      setAiSettings(updated);
      setSuccess("AI settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save AI settings");
    } finally {
      setAiSaving(false);
    }
  };

  const buildContentSections = (cs: ContentStats | null) => {
    if (!cs) return [];
    return [
      { title: "Knowledge Base", desc: "RAG documents for AI agent context", items: cs.knowledgeDocuments },
      { title: "Kundli Charts", desc: "User-generated birth charts", items: cs.kundliCharts },
      { title: "Chat Sessions", desc: "AI astrology consultation threads", items: cs.chatSessions },
      { title: "Reports", desc: "Generated life, career, and marriage reports", items: cs.reports },
      { title: "Palmistry Readings", desc: "Palm image analyses performed", items: cs.palmistryReadings },
      { title: "Matching Results", desc: "Kundli compatibility reports", items: cs.matchingResults },
      { title: "Tarot Readings", desc: "Tarot card spread consultations", items: cs.tarotReadings },
      { title: "Notifications", desc: "User push / in-app notifications", items: cs.notifications },
    ];
  };
  const contentSections = buildContentSections(contentStats);

  const userTotalPages = Math.ceil(userTotal / 20);

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-950" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Admin Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">Manage your Jyotron platform</p>
          </div>
          <div className="surface-card px-4 py-2 rounded-xl text-sm text-white/60">
            Logged in as <span className="text-primary-400 font-medium">{user?.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-white/[0.03] p-1 w-fit overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedUserId(null); }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? "btn-primary text-white" : "text-white/40 hover:text-white"}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-300">&times;</button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {success}
          </div>
        )}

        {/* Edit Modal */}
        {editingUser && (
          <EditUserModal
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={(data) => handleUpdateUser(editingUser.id, data)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            {/* Dashboard Stats */}
            {activeTab === "dashboard" && stats && (
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: "Total Users", value: stats.totalUsers, color: "text-blue-400", icon: "\uD83D\uDC65" },
                    { label: "Premium Users", value: stats.premiumUsers, color: "text-purple-400", icon: "\uD83D\uDC8E" },
                    { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), color: "text-emerald-400", icon: "\uD83D\uDCB0" },
                    { label: "New Today", value: stats.newUsersToday, color: "text-accent-400", icon: "\uD83C\uDF1F" },
                    { label: "Total Chats", value: stats.totalChats, color: "text-pink-400", icon: "\uD83D\uDCAC" },
                    { label: "Kundli Charts", value: stats.totalKundlis, color: "text-mystic-400", icon: "\uD83E\uDE90" },
                    { label: "Payments", value: stats.totalPayments, color: "text-emerald-400", icon: "\uD83D\uDCB3" },
                    { label: "Active Subs", value: stats.activeSubscriptions, color: "text-cyan-400", icon: "\u2728" },
                  ].map((stat) => (
                    <div key={stat.label} className="surface-card p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-white/30">{stat.label}</p>
                        <span className="text-lg">{stat.icon}</span>
                      </div>
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
                <div className="grid sm:grid-cols-4 gap-4">
                  <button onClick={() => setActiveTab("users")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
                    <p className="text-sm font-medium text-white">Manage Users</p>
                    <p className="text-xs text-white/30 mt-1">View, edit, delete users</p>
                  </button>
                  <button onClick={() => setActiveTab("activity")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
                    <p className="text-sm font-medium text-white">Activity Log</p>
                    <p className="text-xs text-white/30 mt-1">Track and undo changes</p>
                  </button>
                  <button onClick={() => setActiveTab("ai")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
                    <p className="text-sm font-medium text-white">AI Agent Status</p>
                    <p className="text-xs text-white/30 mt-1">Monitor 8 active agents</p>
                  </button>
                  <button onClick={() => setActiveTab("analytics")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
                    <p className="text-sm font-medium text-white">View Analytics</p>
                    <p className="text-xs text-white/30 mt-1">Platform usage metrics</p>
                  </button>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === "analytics" && (
              <div>
                <h2 className="text-xl font-bold text-gradient mb-6">Platform Analytics</h2>
                {!analytics ? (
                  <div className="surface-card p-8 text-center text-white/40 text-sm">Loading analytics…</div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {[
                        { label: "Sessions Today", value: analytics.sessionsToday.toLocaleString() },
                        { label: "Avg. Sessions/Day (7d)", value: analytics.avgSessionsPerDay.toLocaleString() },
                        { label: "Avg. Chat Length", value: `${analytics.avgChatLength} msgs` },
                        { label: "Credits Used (Today)", value: analytics.creditsConsumedToday.toLocaleString() },
                        { label: "Credits Used (7d)", value: analytics.creditsConsumedLast7Days.toLocaleString() },
                        { label: "User Retention (30d)", value: `${analytics.retention.day30}%` },
                        { label: "Conversion Rate", value: `${analytics.conversionRate}%` },
                        { label: "LLM Calls (7d)", value: analytics.llmTotals.callsLast7Days.toLocaleString() },
                        { label: "LLM Cost (7d)", value: `$${analytics.llmTotals.totalCostUsdLast7Days.toFixed(4)}` },
                      ].map((m) => (
                        <div key={m.label} className="surface-card p-5">
                          <p className="text-xs text-white/30 mb-1">{m.label}</p>
                          <div className="flex items-end gap-2">
                            <p className="text-2xl font-bold text-white">{m.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <h3 className="text-lg font-bold text-white mb-4">Feature Usage Breakdown</h3>
                    <div className="surface-card p-6 mb-8">
                      {analytics.featureUsage.length === 0 || analytics.featureUsage.every((f) => f.count === 0) ? (
                        <p className="text-sm text-white/40 text-center py-4">No feature usage data yet</p>
                      ) : (
                        analytics.featureUsage.map((f, i) => {
                          const colors = [
                            "from-blue-500 to-cyan-500",
                            "from-purple-500 to-violet-500",
                            "from-red-500 to-orange-500",
                            "from-pink-500 to-rose-500",
                            "from-emerald-500 to-green-500",
                            "from-yellow-500 to-amber-500",
                          ];
                          return (
                            <div key={f.feature} className="flex items-center gap-4 mb-3 last:mb-0">
                              <span className="text-sm text-white/40 w-20">{f.feature}</span>
                              <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden">
                                <div className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-full transition-all`} style={{ width: `${f.percent}%` }} />
                              </div>
                              <span className="text-sm font-medium text-white w-16 text-right">{f.count.toLocaleString()}</span>
                              <span className="text-xs text-white/30 w-12 text-right">{f.percent}%</span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white mb-4">Revenue Trend (Last 7 Days)</h3>
                    <div className="surface-card p-6 mb-8">
                      {(() => {
                        const maxRev = Math.max(...analytics.revenueTrend.map((d) => d.revenue), 1);
                        const total = analytics.revenueTrend.reduce((sum, d) => sum + d.revenue, 0);
                        return (
                          <>
                            <div className="flex items-end gap-2 h-40">
                              {analytics.revenueTrend.map((d) => {
                                const label = new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" });
                                return (
                                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full bg-gradient-to-t from-primary-600 to-mystic-500 rounded-t-lg transition-all" style={{ height: `${Math.max((d.revenue / maxRev) * 100, 2)}%` }} />
                                    <span className="text-[10px] text-white/30">{label}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                              <span className="text-sm text-white/40">Weekly Total</span>
                              <span className="text-lg font-bold text-gradient">{formatCurrency(total)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">LLM Cost Per User</h3>
                      <select
                        value={llmCostDays}
                        onChange={(e) => setLlmCostDays(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-xs focus:outline-none focus:border-primary-500"
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                      </select>
                    </div>
                    <div className="surface-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              <th className="text-left px-4 py-3 text-xs font-medium text-white/40">User</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Email</th>
                              <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Calls</th>
                              <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Tokens</th>
                              <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Cost (USD)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {llmCosts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-white/30 text-xs">No LLM usage recorded in this period.</td>
                              </tr>
                            ) : (
                              llmCosts.map((row, idx) => (
                                <tr key={`${row.userId ?? 'unknown'}-${idx}`} className="border-b border-white/5">
                                  <td className="px-4 py-3 text-white">{row.userName ?? <span className="text-white/30 italic">Deleted user</span>}</td>
                                  <td className="px-4 py-3 text-white/60">{row.userEmail ?? "—"}</td>
                                  <td className="px-4 py-3 text-right text-white/80">{row.calls.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-white/80">{row.totalTokens.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right font-medium text-emerald-400">${row.totalCostUsd.toFixed(4)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Users Management */}
            {activeTab === "users" && (
              <div>
                {/* Search bar */}
                <div className="flex gap-4 mb-6">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or phone..."
                    className="flex-1 max-w-md px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                    onKeyDown={(e) => { if (e.key === "Enter") { setUserPage(1); loadData(); } }} />
                  <button onClick={() => { setUserPage(1); loadData(); }} className="px-5 py-2.5 rounded-xl surface-card text-sm text-primary-400 hover:bg-white/10">Search</button>
                </div>
                <p className="text-sm text-white/30 mb-4">{userTotal} users total</p>

                {/* User detail panel (when selected) */}
                {selectedUserId && (
                  <div className="mb-6">
                    <UserDetailPanel
                      userId={selectedUserId}
                      token={accessToken!}
                      onClose={() => setSelectedUserId(null)}
                      onEdit={(user) => setEditingUser(user)}
                      onDelete={handleDeleteUser}
                      onCancelSubscription={handleCancelSubscription}
                    />
                  </div>
                )}

                {/* Users table */}
                <div className="surface-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Role</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Credits</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Subscription</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Joined</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer ${selectedUserId === u.id ? "bg-primary-600/10" : ""}`}
                            onClick={() => setSelectedUserId(u.id === selectedUserId ? null : u.id)}>
                            <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                            <td className="px-4 py-3 text-white/60">{u.email}</td>
                            <td className="px-4 py-3">{roleBadge(u.role)}</td>
                            <td className="px-4 py-3 text-white/60">{u.credits}</td>
                            <td className="px-4 py-3">
                              {u.subscriptionPlan ? (
                                <div className="flex items-center gap-1">
                                  <Badge variant="purple">{u.subscriptionPlan}</Badge>
                                  {u.subscriptionStatus && statusBadge(u.subscriptionStatus)}
                                </div>
                              ) : (
                                <span className="text-xs text-white/20">Free</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-white/30 text-xs">{formatDate(u.createdAt)}</td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-2">
                                <select onChange={(e) => handleQuickRoleChange(u.id, e.target.value)} value={u.role}
                                  className="text-xs px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60">
                                  <option value="USER">User</option>
                                  <option value="PREMIUM">Premium</option>
                                  <option value="ADMIN">Admin</option>
                                </select>
                                <button onClick={() => handleDeleteUser(u.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr><td colSpan={7} className="px-4 py-8 text-center text-white/30">No users found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {userTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button onClick={() => setUserPage(Math.max(1, userPage - 1))} disabled={userPage === 1}
                      className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/60 disabled:opacity-30">Prev</button>
                    <span className="text-sm text-white/40">Page {userPage} of {userTotalPages}</span>
                    <button onClick={() => setUserPage(Math.min(userTotalPages, userPage + 1))} disabled={userPage === userTotalPages}
                      className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/60 disabled:opacity-30">Next</button>
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && accessToken && (
              <ActivityTab token={accessToken} />
            )}

            {/* Payments */}
            {activeTab === "payments" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">User</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any) => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                          <td className="px-4 py-3 text-white">{p.userName}<br /><span className="text-xs text-white/30">{p.userEmail}</span></td>
                          <td className="px-4 py-3 text-white/60">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3">{statusBadge(p.status)}</td>
                          <td className="px-4 py-3 text-white/40">{p.type}</td>
                          <td className="px-4 py-3 text-white/30 text-xs">{formatDate(p.createdAt)}</td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">No payments yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Chats */}
            {activeTab === "chats" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">User</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Title</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Category</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Messages</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chats.map((c: any) => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                          <td className="px-4 py-3 text-white">{c.userName}<br /><span className="text-xs text-white/30">{c.userEmail}</span></td>
                          <td className="px-4 py-3 text-white/60">{c.title}</td>
                          <td className="px-4 py-3"><Badge>{c.category}</Badge></td>
                          <td className="px-4 py-3 text-white/60">{c.messageCount}</td>
                          <td className="px-4 py-3 text-white/30 text-xs">{formatDate(c.updatedAt)}</td>
                        </tr>
                      ))}
                      {chats.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">No chats yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pricing Management */}
            {activeTab === "pricing" && (
              <div>
                <h2 className="text-xl font-bold text-gradient mb-6">Pricing Management</h2>

                {/* Subscription Plans */}
                <h3 className="text-lg font-bold text-white mb-4">Subscription Plans</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div className="surface-card p-6">
                    <h4 className="font-bold text-white mb-4">Premium Monthly</h4>
                    <label className="block text-xs text-white/30 mb-2">Price (INR)</label>
                    <input type="number" value={pricingMonthly} onChange={(e) => setPricingMonthly(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm" />
                  </div>
                  <div className="surface-card p-6">
                    <h4 className="font-bold text-white mb-4">Premium Annual</h4>
                    <label className="block text-xs text-white/30 mb-2">Price (INR)</label>
                    <input type="number" value={pricingAnnual} onChange={(e) => setPricingAnnual(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm" />
                  </div>
                </div>

                {/* Credit Packs */}
                <h3 className="text-lg font-bold text-white mb-4">Credit Packs</h3>
                <div className="grid sm:grid-cols-3 gap-4 mb-8">
                  <div className="surface-card p-6">
                    <h4 className="font-bold text-white mb-4">Starter Pack</h4>
                    <label className="block text-xs text-white/30 mb-2">Credits</label>
                    <input type="number" value={creditStarterCredits} onChange={(e) => setCreditStarterCredits(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm mb-3" />
                    <label className="block text-xs text-white/30 mb-2">Price (INR)</label>
                    <input type="number" value={creditStarterPrice} onChange={(e) => setCreditStarterPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm" />
                  </div>
                  <div className="surface-card p-6">
                    <h4 className="font-bold text-white mb-4">Popular Pack</h4>
                    <label className="block text-xs text-white/30 mb-2">Credits</label>
                    <input type="number" value={creditPopularCredits} onChange={(e) => setCreditPopularCredits(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm mb-3" />
                    <label className="block text-xs text-white/30 mb-2">Price (INR)</label>
                    <input type="number" value={creditPopularPrice} onChange={(e) => setCreditPopularPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm" />
                  </div>
                  <div className="surface-card p-6">
                    <h4 className="font-bold text-white mb-4">Pro Pack</h4>
                    <label className="block text-xs text-white/30 mb-2">Credits</label>
                    <input type="number" value={creditProCredits} onChange={(e) => setCreditProCredits(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm mb-3" />
                    <label className="block text-xs text-white/30 mb-2">Price (INR)</label>
                    <input type="number" value={creditProPrice} onChange={(e) => setCreditProPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm" />
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
                <p className="text-xs text-white/20 mt-3">Changes are applied immediately to the pricing page.</p>
              </div>
            )}

            {/* AI & LLM Management */}
            {activeTab === "ai" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gradient">AI &amp; LLM Management</h2>
                  <button onClick={saveAiSettings} disabled={aiSaving} className="px-5 py-2 btn-primary rounded-xl text-sm disabled:opacity-50">
                    {aiSaving ? "Saving..." : "Save All Changes"}
                  </button>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1.5 mb-6 p-1 rounded-xl bg-white/[0.03] w-fit">
                  {([
                    { id: "providers" as const, label: "LLM Providers" },
                    { id: "usage" as const, label: "Token Usage" },
                    { id: "features" as const, label: "Feature Controls" },
                  ]).map(t => (
                    <button key={t.id} onClick={() => setAiSubTab(t.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${aiSubTab === t.id ? "bg-primary-600 text-white" : "text-white/40 hover:text-white/60"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ── SUB-TAB: LLM Providers ── */}
                {aiSubTab === "providers" && (
                  <div className="space-y-6">
                    {/* Global Default */}
                    <div className="surface-card p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Global Defaults</h3>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-white/30 mb-1.5">Default Provider</label>
                          <select value={getAiSetting("llm.default.provider", "openai")} onChange={e => setAiSetting("llm.default.provider", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                            {llmProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-white/30 mb-1.5">Default Model</label>
                          <select value={getAiSetting("llm.default.model", "gpt-4o")} onChange={e => setAiSetting("llm.default.model", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                            {(llmProviders.find(p => p.id === getAiSetting("llm.default.provider", "openai"))?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-white/30 mb-1.5">Temperature</label>
                          <input type="number" min={0} max={2} step={0.1} value={getAiSetting("llm.default.temperature", "0.7")} onChange={e => setAiSetting("llm.default.temperature", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                        </div>
                      </div>
                    </div>

                    {/* Per-provider cards */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      {llmProviders.map(provider => {
                        const enabled = getAiSetting(`llm.${provider.id}.enabled`, provider.id === "openai" ? "true" : "false") === "true";
                        const hasKey = !!getAiSetting(provider.keyField);
                        return (
                          <div key={provider.id} className={`surface-card p-5 transition-all ${enabled ? "ring-1 ring-white/[0.1]" : "opacity-60"}`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2.5">
                                <span className={`text-lg font-bold ${provider.color}`}>{provider.name}</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={enabled} onChange={e => setAiSetting(`llm.${provider.id}.enabled`, e.target.checked ? "true" : "false")} className="sr-only peer" />
                                <div className="w-9 h-5 bg-white/10 peer-checked:bg-primary-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                              </label>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[11px] text-white/30 mb-1">API Key</label>
                                <input type="password" placeholder={hasKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved)" : "Enter API key..."} value={getAiSetting(provider.keyField)} onChange={e => setAiSetting(provider.keyField, e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg surface-input text-xs font-mono" />
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${hasKey && enabled ? "bg-emerald-400" : hasKey ? "bg-amber-400" : "bg-white/20"}`} />
                                  <span className="text-[11px] text-white/40">{hasKey && enabled ? "Active" : hasKey ? "Key set, disabled" : "No key"}</span>
                                </div>
                                <span className="text-[11px] text-white/30">{provider.models.length} models</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── SUB-TAB: Token Usage ── */}
                {aiSubTab === "usage" && (
                  <div className="space-y-6">
                    {/* Global limits */}
                    <div className="surface-card p-5">
                      <h3 className="text-sm font-semibold text-white mb-1">Global Token Budget</h3>
                      <p className="text-xs text-white/30 mb-4">Set monthly token limits. When exceeded, features auto-fallback to Knowledge Base.</p>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[11px] text-white/30 mb-1">Monthly Token Limit (global)</label>
                          <input type="number" value={getAiSetting("llm.budget.monthly_tokens", "1000000")} onChange={e => setAiSetting("llm.budget.monthly_tokens", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-white/30 mb-1">Per-User Daily Limit</label>
                          <input type="number" value={getAiSetting("llm.budget.user_daily_tokens", "10000")} onChange={e => setAiSetting("llm.budget.user_daily_tokens", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg surface-input text-sm" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-white/30 mb-1">Fallback Behavior</label>
                          <select value={getAiSetting("llm.budget.fallback", "knowledge_base")} onChange={e => setAiSetting("llm.budget.fallback", e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg surface-input text-sm">
                            <option value="knowledge_base">Use Knowledge Base</option>
                            <option value="block">Block &amp; Show Limit Message</option>
                            <option value="degrade">Use Cheaper Model</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Per-feature token usage table */}
                    <div className="surface-card p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Token Usage by Feature</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              <th className="text-left text-[11px] text-white/30 font-medium py-2 pr-4">Feature</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Tokens/Call</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Today</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">This Month</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Calls</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Est. Cost</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 pl-3">Limit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aiFeatures.filter(f => f.tokensPerCall !== "0").map(feature => {
                              const monthlyTokens = parseInt(getAiSetting(`llm.usage.${feature.id}.monthly_tokens`, "0"));
                              const todayTokens = parseInt(getAiSetting(`llm.usage.${feature.id}.today_tokens`, "0"));
                              const calls = parseInt(getAiSetting(`llm.usage.${feature.id}.calls`, "0"));
                              const featureLimit = getAiSetting(`llm.limit.${feature.id}`, "");
                              const estCost = (monthlyTokens / 1000000 * 2.5).toFixed(2); // ~$2.50/1M tokens avg
                              return (
                                <tr key={feature.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                  <td className="py-2.5 pr-4">
                                    <p className="text-white/80 font-medium">{feature.name}</p>
                                    <p className="text-[11px] text-white/30">{feature.desc}</p>
                                  </td>
                                  <td className="text-right text-white/40 px-3 tabular-nums">{feature.tokensPerCall}</td>
                                  <td className="text-right text-white/60 px-3 tabular-nums">{todayTokens.toLocaleString()}</td>
                                  <td className="text-right text-white/60 px-3 tabular-nums">{monthlyTokens.toLocaleString()}</td>
                                  <td className="text-right text-white/40 px-3 tabular-nums">{calls.toLocaleString()}</td>
                                  <td className="text-right text-accent-400/80 px-3 tabular-nums">${estCost}</td>
                                  <td className="text-right pl-3">
                                    <input type="number" placeholder="No limit" value={featureLimit} onChange={e => setAiSetting(`llm.limit.${feature.id}`, e.target.value)}
                                      className="w-20 px-2 py-1 rounded text-right surface-input text-xs tabular-nums" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Per-user stats */}
                    <div className="surface-card p-5">
                      <h3 className="text-sm font-semibold text-white mb-1">Top Token Consumers</h3>
                      <p className="text-xs text-white/30 mb-4">Users ranked by token consumption this month. Set per-user overrides from the Users tab.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              <th className="text-left text-[11px] text-white/30 font-medium py-2 pr-4">User</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Tokens Used</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Calls</th>
                              <th className="text-right text-[11px] text-white/30 font-medium py-2 px-3">Daily Limit</th>
                              <th className="text-center text-[11px] text-white/30 font-medium py-2 pl-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(users.length > 0 ? users.slice(0, 10) : []).map(u => {
                              const userTokens = parseInt(getAiSetting(`llm.user.${u.id}.monthly_tokens`, "0"));
                              const userCalls = parseInt(getAiSetting(`llm.user.${u.id}.calls`, "0"));
                              const userLimit = getAiSetting(`llm.user.${u.id}.daily_limit`, getAiSetting("llm.budget.user_daily_tokens", "10000"));
                              const isOverLimit = userTokens > parseInt(userLimit) * 30;
                              return (
                                <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                  <td className="py-2.5 pr-4">
                                    <p className="text-white/80 text-xs font-medium">{u.name}</p>
                                    <p className="text-[11px] text-white/30">{u.email}</p>
                                  </td>
                                  <td className="text-right text-white/60 px-3 tabular-nums text-xs">{userTokens.toLocaleString()}</td>
                                  <td className="text-right text-white/40 px-3 tabular-nums text-xs">{userCalls.toLocaleString()}</td>
                                  <td className="text-right px-3">
                                    <input type="number" value={getAiSetting(`llm.user.${u.id}.daily_limit`, "")} onChange={e => setAiSetting(`llm.user.${u.id}.daily_limit`, e.target.value)}
                                      placeholder={getAiSetting("llm.budget.user_daily_tokens", "10000")}
                                      className="w-20 px-2 py-1 rounded text-right surface-input text-xs tabular-nums" />
                                  </td>
                                  <td className="text-center pl-3">
                                    {isOverLimit ? <Badge variant="danger">Over Limit</Badge> : <Badge variant="success">OK</Badge>}
                                  </td>
                                </tr>
                              );
                            })}
                            {users.length === 0 && (
                              <tr><td colSpan={5} className="py-6 text-center text-white/30 text-xs">Load Users tab first to see per-user stats</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SUB-TAB: Feature Controls ── */}
                {aiSubTab === "features" && (
                  <div className="space-y-6">
                    {/* Legend */}
                    <div className="surface-card p-4 flex flex-wrap gap-4 text-xs">
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-500" /> <span className="text-white/40">Using AI / LLM</span></div>
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-white/40">Using Knowledge Base only</span></div>
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> <span className="text-white/40">Hybrid (AI + KB fallback)</span></div>
                    </div>

                    {/* Feature toggle list */}
                    <div className="space-y-2">
                      {aiFeatures.map(feature => {
                        const mode = getAiSetting(`llm.feature.${feature.id}.mode`, feature.needsAI ? "ai" : "kb");
                        const model = getAiSetting(`llm.feature.${feature.id}.model`, "");
                        const provider = getAiSetting(`llm.feature.${feature.id}.provider`, "");
                        const maxTokens = getAiSetting(`llm.feature.${feature.id}.max_tokens`, "");
                        return (
                          <div key={feature.id} className="surface-card p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              {/* Feature info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${mode === "ai" ? "bg-primary-500" : mode === "hybrid" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                  <h4 className="text-sm font-medium text-white">{feature.name}</h4>
                                </div>
                                <p className="text-[11px] text-white/30 mt-0.5 ml-4">{feature.desc}</p>
                              </div>

                              {/* Suggestion chip */}
                              <div className="sm:text-right shrink-0">
                                <span className={`text-[11px] font-medium ${feature.sugColor}`}>{feature.suggestion}</span>
                              </div>

                              {/* Mode toggle */}
                              <div className="flex gap-1 shrink-0">
                                {(["ai", "hybrid", "kb"] as const).map(m => (
                                  <button key={m} onClick={() => setAiSetting(`llm.feature.${feature.id}.mode`, m)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${mode === m
                                      ? m === "ai" ? "bg-primary-600 text-white" : m === "hybrid" ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
                                      : "bg-white/[0.04] text-white/30 hover:text-white/50"
                                    }`}>
                                    {m === "ai" ? "AI" : m === "hybrid" ? "Hybrid" : "KB Only"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Expanded config when AI or Hybrid */}
                            {(mode === "ai" || mode === "hybrid") && (
                              <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-4 gap-3 ml-4">
                                <div>
                                  <label className="block text-[10px] text-white/25 mb-1">Provider Override</label>
                                  <select value={provider} onChange={e => setAiSetting(`llm.feature.${feature.id}.provider`, e.target.value)}
                                    className="w-full px-2 py-1.5 rounded surface-input text-xs">
                                    <option value="">Use Default</option>
                                    {llmProviders.filter(p => getAiSetting(`llm.${p.id}.enabled`, p.id === "openai" ? "true" : "false") === "true").map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-white/25 mb-1">Model Override</label>
                                  <select value={model} onChange={e => setAiSetting(`llm.feature.${feature.id}.model`, e.target.value)}
                                    className="w-full px-2 py-1.5 rounded surface-input text-xs">
                                    <option value="">Use Default</option>
                                    {(llmProviders.find(p => p.id === (provider || getAiSetting("llm.default.provider", "openai")))?.models || []).map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-white/25 mb-1">Max Tokens</label>
                                  <input type="number" placeholder="Default" value={maxTokens} onChange={e => setAiSetting(`llm.feature.${feature.id}.max_tokens`, e.target.value)}
                                    className="w-full px-2 py-1.5 rounded surface-input text-xs" />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-white/25 mb-1">Est. Tokens/Call</label>
                                  <p className="text-xs text-white/40 py-1.5">{feature.tokensPerCall}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Suggestion banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-primary-600/8 to-accent-500/5 border border-primary-500/10">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-primary-400 mb-1">Cost Optimization Suggestion</h4>
                          <p className="text-xs text-white/50 leading-relaxed">
                            <strong className="text-white/70">Panchang, Muhurat, Numerology, Kundli Matching, and Daily Horoscope</strong> can run entirely on the Knowledge Base with rule-based computation, saving ~60% of token costs.
                            Only <strong className="text-white/70">AI Chat, Palmistry (vision), and Report Generation</strong> truly require LLM calls.
                            Use <strong className="text-white/70">Hybrid mode</strong> for features like Kundli Interpretation to use KB first and fall back to AI only for complex queries.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Content Management */}
            {activeTab === "content" && (
              <div>
                <h2 className="text-xl font-bold text-gradient mb-6">Content Management</h2>
                {!contentStats ? (
                  <div className="surface-card p-8 text-center text-white/40 text-sm">Loading content stats…</div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {contentSections.map((section) => (
                        <div key={section.title} className="surface-card p-5">
                          <h3 className="font-bold text-white mb-1">{section.title}</h3>
                          <p className="text-xs text-white/40 mb-3">{section.desc}</p>
                          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                            <div>
                              <p className="text-lg font-bold text-gradient">{section.items.toLocaleString()}</p>
                              <p className="text-[10px] text-white/30">items</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {contentStats.knowledgeCategories.length > 0 && (
                      <>
                        <h3 className="text-lg font-bold text-white mt-8 mb-4">Knowledge Base by Category</h3>
                        <div className="surface-card p-6">
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {contentStats.knowledgeCategories.map((cat) => (
                              <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                                <span className="text-sm text-white/70 capitalize">{cat.category}</span>
                                <span className="text-sm font-bold text-primary-400">{cat.count.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
