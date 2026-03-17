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

type TabId = "dashboard" | "users" | "payments" | "chats" | "analytics" | "ai" | "content" | "activity";

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

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "ADMIN") {
      router.push("/auth");
      return;
    }
    loadData();
  }, [isAuthenticated, user, activeTab, userPage]);

  const loadData = async () => {
    if (!accessToken) return;
    if (activeTab === "analytics" || activeTab === "ai" || activeTab === "content" || activeTab === "activity") {
      setLoading(false);
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
    { id: "ai", label: "AI Agents", icon: "\uD83E\uDD16" },
    { id: "content", label: "Content", icon: "\uD83D\uDCDD" },
  ];

  const aiAgents = [
    { name: "Career Agent", category: "career", status: "active", model: "gpt-4o", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.25) : 0 },
    { name: "Relationship Agent", category: "relationship", status: "active", model: "gpt-4o", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.2) : 0 },
    { name: "Kundli Agent", category: "kundli", status: "active", model: "gpt-4o", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.15) : 0 },
    { name: "Remedy Agent", category: "remedy", status: "active", model: "gpt-4o", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.1) : 0 },
    { name: "Palmistry Agent", category: "palmistry", status: "active", model: "gpt-4o (vision)", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.1) : 0 },
    { name: "Wealth Agent", category: "wealth", status: "active", model: "gpt-4o", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.08) : 0 },
    { name: "Health Agent", category: "health", status: "active", model: "gpt-4o", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.07) : 0 },
    { name: "Numerology Agent", category: "numerology", status: "active", model: "gpt-4o", queries: stats?.totalChats ? Math.floor(stats.totalChats * 0.05) : 0 },
  ];

  const contentSections = [
    { title: "Horoscope Content", desc: "Daily, weekly, monthly horoscope templates", items: 12, lastUpdated: "Today" },
    { title: "Panchang Data", desc: "Hindu calendar data and calculations", items: 365, lastUpdated: "Daily auto-update" },
    { title: "Remedy Database", desc: "Gemstones, mantras, pujas, and fasting recommendations", items: 156, lastUpdated: "2 days ago" },
    { title: "Knowledge Base", desc: "RAG documents for AI agent context", items: 48, lastUpdated: "1 week ago" },
    { title: "Report Templates", desc: "Templates for Life, Career, Marriage, Wealth, Palm, Annual reports", items: 6, lastUpdated: "3 days ago" },
    { title: "Zodiac Profiles", desc: "Detailed sign descriptions and characteristics", items: 12, lastUpdated: "1 month ago" },
  ];

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
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {[
                    { label: "Avg. Sessions/Day", value: "342", change: "+12%", positive: true },
                    { label: "Avg. Chat Length", value: "4.7 msgs", change: "+8%", positive: true },
                    { label: "Credit Consumption", value: "1,240/day", change: "+15%", positive: true },
                    { label: "API Response Time", value: "1.8s", change: "-5%", positive: true },
                    { label: "User Retention (7d)", value: "68%", change: "+3%", positive: true },
                    { label: "Conversion Rate", value: "4.2%", change: "-0.3%", positive: false },
                  ].map((m) => (
                    <div key={m.label} className="surface-card p-5">
                      <p className="text-xs text-white/30 mb-1">{m.label}</p>
                      <div className="flex items-end gap-2">
                        <p className="text-2xl font-bold text-white">{m.value}</p>
                        <span className={`text-xs font-medium mb-1 ${m.positive ? "text-emerald-400" : "text-red-400"}`}>{m.change}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-bold text-white mb-4">Feature Usage Breakdown</h3>
                <div className="surface-card p-6 mb-8">
                  {[
                    { feature: "AI Chat", pct: 35, color: "from-blue-500 to-cyan-500" },
                    { feature: "Horoscope", pct: 25, color: "from-yellow-500 to-amber-500" },
                    { feature: "Kundli", pct: 15, color: "from-purple-500 to-violet-500" },
                    { feature: "Palmistry", pct: 10, color: "from-pink-500 to-rose-500" },
                    { feature: "Matching", pct: 8, color: "from-red-500 to-orange-500" },
                    { feature: "Reports", pct: 4, color: "from-emerald-500 to-green-500" },
                    { feature: "Muhurat", pct: 3, color: "from-teal-500 to-cyan-500" },
                  ].map((f) => (
                    <div key={f.feature} className="flex items-center gap-4 mb-3 last:mb-0">
                      <span className="text-sm text-white/40 w-20">{f.feature}</span>
                      <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${f.color} rounded-full transition-all`} style={{ width: `${f.pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-white w-10 text-right">{f.pct}%</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-bold text-white mb-4">Revenue Trend (Last 7 Days)</h3>
                <div className="surface-card p-6">
                  <div className="flex items-end gap-2 h-40">
                    {[4200, 3800, 5100, 4700, 6200, 5800, 7100].map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-gradient-to-t from-primary-600 to-mystic-500 rounded-t-lg transition-all" style={{ height: `${(val / 7100) * 100}%` }} />
                        <span className="text-[10px] text-white/30">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                    <span className="text-sm text-white/40">Weekly Total</span>
                    <span className="text-lg font-bold text-gradient">{formatCurrency(36900)}</span>
                  </div>
                </div>
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

            {/* AI Agents Management */}
            {activeTab === "ai" && (
              <div>
                <h2 className="text-xl font-bold text-gradient mb-6">AI Agent Management</h2>
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  {aiAgents.map((agent) => (
                    <div key={agent.name} className="surface-card p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-white">{agent.name}</h3>
                        <Badge variant="success">{agent.status}</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/30">Category</span>
                          <span className="text-white/60">{agent.category}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/30">Model</span>
                          <span className="text-white/60">{agent.model}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/30">Total Queries</span>
                          <span className="text-white/60">{agent.queries}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-bold text-white mb-4">AI Configuration</h3>
                <div className="surface-card p-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/30 mb-2">Default Model</label>
                      <select className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm">
                        <option>gpt-4o</option>
                        <option>gpt-4o-mini</option>
                        <option>gpt-4-turbo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2">Temperature</label>
                      <input type="number" defaultValue={0.7} min={0} max={2} step={0.1}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2">Max Tokens</label>
                      <input type="number" defaultValue={2048}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2">Chat History Depth</label>
                      <input type="number" defaultValue={10}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm" />
                    </div>
                  </div>
                  <p className="text-xs text-white/20 mt-4">Changes to AI configuration require a server restart to take effect. Update via environment variables.</p>
                </div>
              </div>
            )}

            {/* Content Management */}
            {activeTab === "content" && (
              <div>
                <h2 className="text-xl font-bold text-gradient mb-6">Content Management</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contentSections.map((section) => (
                    <div key={section.title} className="surface-card p-5">
                      <h3 className="font-bold text-white mb-1">{section.title}</h3>
                      <p className="text-xs text-white/40 mb-3">{section.desc}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                        <div>
                          <p className="text-lg font-bold text-gradient">{section.items}</p>
                          <p className="text-[10px] text-white/30">items</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/30">Last updated</p>
                          <p className="text-xs text-white/60">{section.lastUpdated}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-bold text-white mt-8 mb-4">Content Actions</h3>
                <div className="surface-card p-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Refresh Panchang Data</p>
                      <p className="text-xs text-white/30">Update today&apos;s Tithi, Nakshatra, and timings</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Update Knowledge Base</p>
                      <p className="text-xs text-white/30">Re-index RAG documents for AI agents</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Generate Weekly Horoscopes</p>
                      <p className="text-xs text-white/30">Batch generate horoscopes for all 12 signs</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Export User Reports</p>
                      <p className="text-xs text-white/30">Download CSV of all generated reports</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
