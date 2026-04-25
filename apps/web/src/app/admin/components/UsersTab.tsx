"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Badge, roleBadge, statusBadge, formatCurrency, formatDate } from "./helpers";
import { EditUserModal } from "./EditUserModal";
import { UserDetailPanel } from "./UserDetailPanel";
import type { UserItem, UserDetail, ChurnRiskRow } from "./types";

export function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null);
  const [churnRisk, setChurnRisk] = useState<ChurnRiskRow[]>([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ users: UserItem[]; total: number }>(
        `/admin/users?search=${encodeURIComponent(search)}&page=${userPage}&limit=20`,
        { token }
      );
      setUsers(res.users);
      setUserTotal(res.total);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token, search, userPage]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Churn risk is a sidebar — load it once per tab mount. Non-blocking:
  // a 500 here shouldn't prevent the user list from rendering.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.get<ChurnRiskRow[]>(`/admin/churn-risk?limit=20`, { token });
        if (!cancelled && Array.isArray(rows)) setChurnRisk(rows);
      } catch {
        // swallow — sidebar is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleUpdateUser = async (userId: string, data: any) => {
    setError("");
    setSuccess("");
    try {
      await api.put(`/admin/users/${userId}`, data, { token });
      setSuccess("User updated successfully");
      setEditingUser(null);
      setSelectedUserId(null);
      loadUsers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user? This cannot be undone.")) return;
    setError("");
    try {
      await api.delete(`/admin/users/${userId}`, { token });
      setSuccess("User deleted successfully");
      setSelectedUserId(null);
      loadUsers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelSubscription = async (subId: string) => {
    if (!confirm("Cancel this subscription?")) return;
    try {
      await api.post(`/admin/subscriptions/${subId}/cancel`, {}, { token });
      setSuccess("Subscription cancelled");
      setSelectedUserId((prev) => { const t = prev; setSelectedUserId(null); setTimeout(() => setSelectedUserId(t), 50); return prev; });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleQuickRoleChange = async (userId: string, role: string) => {
    try {
      await api.put(`/admin/users/${userId}`, { role }, { token });
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /**
   * Admin force-logout — walks the user's refresh-token families in
   * Redis and deletes them all. Existing access tokens keep working
   * until they expire (default 1h); admins are warned accordingly.
   */
  const handleForceLogout = async (userId: string, email: string) => {
    if (!confirm(`Force ${email} off every session? Access tokens keep working until expiry (~1h); refresh tokens are killed immediately.`)) return;
    setError("");
    try {
      const res = await api.post<{ familiesRevoked: number }>(
        `/admin/users/${userId}/force-logout`,
        {},
        { token },
      );
      setSuccess(`Logged out — ${res.familiesRevoked} session famil${res.familiesRevoked === 1 ? "y" : "ies"} revoked.`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to force-logout user");
    }
  };

  const userTotalPages = Math.ceil(userTotal / 20);

  return (
    <div>
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

      {/* Search bar */}
      <div className="flex gap-4 mb-6">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or phone..."
          className="flex-1 max-w-md px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
          onKeyDown={(e) => { if (e.key === "Enter") { setUserPage(1); loadUsers(); } }} />
        <button onClick={() => { setUserPage(1); loadUsers(); }} className="px-5 py-2.5 rounded-xl surface-card text-sm text-primary-400 hover:bg-white/10">Search</button>
      </div>
      <p className="text-sm text-white/30 mb-4">{userTotal} users total</p>

      {/* Churn-risk sidebar. Rendered inline at the top so admins see
          it before scrolling the users table. Each row jumps to the
          user's detail panel on click; payment-fail rows also expose
          a "Retry" button that fires an in-app nudge. */}
      <ChurnRiskSidebar
        rows={churnRisk}
        onSelect={(userId) => setSelectedUserId(userId)}
        onRetry={async (userId) => {
          try {
            await api.post(`/admin/churn-risk/${userId}/retry-email`, {}, { token });
            setSuccess("Retry notification sent.");
            setTimeout(() => setSuccess(""), 2500);
          } catch (err: any) {
            setError(err?.message || "Failed to send retry notification");
          }
        }}
      />

      {/* User detail panel */}
      {selectedUserId && (
        <div className="mb-6">
          <UserDetailPanel
            userId={selectedUserId}
            token={token}
            onClose={() => setSelectedUserId(null)}
            onEdit={(user) => setEditingUser(user)}
            onDelete={handleDeleteUser}
            onCancelSubscription={handleCancelSubscription}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <>
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
                          <button
                            onClick={() => handleForceLogout(u.id, u.email)}
                            data-testid={`force-logout-${u.id}`}
                            className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                            title="Revoke all refresh-token families for this user"
                          >
                            Logout
                          </button>
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
        </>
      )}
    </div>
  );
}

function ChurnRiskSidebar({
  rows,
  onSelect,
  onRetry,
}: {
  rows: ChurnRiskRow[];
  onSelect: (userId: string) => void;
  onRetry: (userId: string) => Promise<void>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6 surface-card p-6" data-testid="churn-risk-sidebar">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Churn risk</h3>
          <p className="text-xs text-white/40 mt-0.5">
            Premium users renewing in ≤14d with no chat in 14d,
            plus users with ≥2 recent failed payments.
          </p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 tabular-nums">
          {rows.length} at risk
        </span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.slice(0, 9).map((r) => (
          <div
            key={`${r.userId}-${r.reason}`}
            className="text-left p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-all"
            data-testid={`churn-row-${r.userId}`}
          >
            <button
              onClick={() => onSelect(r.userId)}
              className="text-left w-full"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{r.name}</p>
                  <p className="text-[11px] text-white/40 truncate">{r.email}</p>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                    r.reason === "payment_fail"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {r.reason === "payment_fail" ? "pay-fail" : "inactive"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px]">
                <span className="text-white/50">
                  {r.reason === "payment_fail"
                    ? `${r.recentFailedPayments ?? 0} failed 30d`
                    : `${r.plan ?? ""} · renews ${
                        r.endDate
                          ? new Date(r.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                          : "—"
                      }`}
                </span>
                <span className="text-amber-400 tabular-nums">
                  {r.reason === "payment_fail"
                    ? ""
                    : r.daysSinceLastChat == null
                      ? "never chatted"
                      : `${r.daysSinceLastChat}d idle`}
                </span>
              </div>
            </button>
            {r.reason === "payment_fail" && (
              <button
                onClick={() => onRetry(r.userId)}
                data-testid={`retry-${r.userId}`}
                className="mt-2 w-full text-[11px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              >
                Send retry notification
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
