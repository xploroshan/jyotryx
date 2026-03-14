"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

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
}

export default function AdminPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "payments" | "chats">("dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [userTotal, setUserTotal] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "ADMIN") {
      router.push("/auth");
      return;
    }
    loadData();
  }, [isAuthenticated, user, activeTab]);

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      switch (activeTab) {
        case "dashboard":
          const dashStats = await api.get<DashboardStats>("/admin/dashboard", { token: accessToken });
          setStats(dashStats);
          break;
        case "users":
          const usersRes = await api.get<{ users: UserItem[]; total: number }>(`/admin/users?search=${search}`, { token: accessToken });
          setUsers(usersRes.users);
          setUserTotal(usersRes.total);
          break;
        case "payments":
          const paymentsRes = await api.get<any[]>("/admin/payments", { token: accessToken });
          setPayments(paymentsRes);
          break;
        case "chats":
          const chatsRes = await api.get<any[]>("/admin/chats", { token: accessToken });
          setChats(chatsRes);
          break;
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, role: string) => {
    try {
      await api.put(`/admin/users/${userId}`, { role }, { token: accessToken! });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/admin/users/${userId}`, { token: accessToken! });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", icon: "\uD83D\uDCCA" },
    { id: "users" as const, label: "Users", icon: "\uD83D\uDC65" },
    { id: "payments" as const, label: "Payments", icon: "\uD83D\uDCB3" },
    { id: "chats" as const, label: "Chats", icon: "\uD83D\uDCAC" },
  ];

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-gradient">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Manage your Jyotryx platform</p>
          </div>
          <div className="glass px-4 py-2 rounded-xl text-sm text-gray-300">
            Logged in as <span className="text-primary-400 font-medium">{user?.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-white/5 p-1 w-fit">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white" : "text-gray-400 hover:text-white"}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: stats.totalUsers, color: "text-blue-400" },
                  { label: "Premium Users", value: stats.premiumUsers, color: "text-purple-400" },
                  { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), color: "text-emerald-400" },
                  { label: "New Today", value: stats.newUsersToday, color: "text-accent-400" },
                  { label: "Total Chats", value: stats.totalChats, color: "text-pink-400" },
                  { label: "Kundli Charts", value: stats.totalKundlis, color: "text-mystic-400" },
                  { label: "Payments", value: stats.totalPayments, color: "text-emerald-400" },
                  { label: "Active Subs", value: stats.activeSubscriptions, color: "text-cyan-400" },
                ].map((stat) => (
                  <div key={stat.label} className="glass-card p-6">
                    <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Users Management */}
            {activeTab === "users" && (
              <div>
                <div className="flex gap-4 mb-6">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
                    className="flex-1 max-w-md px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500"
                    onKeyDown={(e) => e.key === "Enter" && loadData()} />
                  <button onClick={loadData} className="px-5 py-2.5 rounded-xl glass text-sm text-primary-400 hover:bg-white/10">Search</button>
                </div>
                <p className="text-sm text-gray-500 mb-4">{userTotal} users total</p>
                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Role</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Credits</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Joined</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-4 py-3 text-white">{u.name}</td>
                            <td className="px-4 py-3 text-gray-300">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded-full ${u.role === "ADMIN" ? "bg-red-500/20 text-red-400" : u.role === "PREMIUM" ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-gray-400"}`}>{u.role}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-300">{u.credits}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <select onChange={(e) => handleUpdateUser(u.id, e.target.value)} value={u.role}
                                  className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">
                                  <option value="USER">User</option>
                                  <option value="PREMIUM">Premium</option>
                                  <option value="ADMIN">Admin</option>
                                </select>
                                <button onClick={() => handleDeleteUser(u.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Payments */}
            {activeTab === "payments" && (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">User</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any) => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-white">{p.userName}<br /><span className="text-xs text-gray-500">{p.userEmail}</span></td>
                          <td className="px-4 py-3 text-gray-300">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${p.status === "SUCCESS" ? "bg-emerald-500/20 text-emerald-400" : p.status === "PENDING" ? "bg-accent-500/20 text-accent-400" : "bg-red-500/20 text-red-400"}`}>{p.status}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{p.type}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No payments yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Chats */}
            {activeTab === "chats" && (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">User</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Title</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Category</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Messages</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chats.map((c: any) => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-white">{c.userName}<br /><span className="text-xs text-gray-500">{c.userEmail}</span></td>
                          <td className="px-4 py-3 text-gray-300">{c.title}</td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">{c.category}</span></td>
                          <td className="px-4 py-3 text-gray-300">{c.messageCount}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.updatedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {chats.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No chats yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
