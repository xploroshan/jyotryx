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

type TabId = "dashboard" | "users" | "payments" | "chats" | "analytics" | "ai" | "content";

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
    if (activeTab === "analytics" || activeTab === "ai" || activeTab === "content") {
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
          const usersRes = await api.get<{ users: UserItem[]; total: number }>(`/admin/users?search=${search}`, { token: accessToken });
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

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "\uD83D\uDCCA" },
    { id: "analytics", label: "Analytics", icon: "\uD83D\uDCC8" },
    { id: "users", label: "Users", icon: "\uD83D\uDC65" },
    { id: "payments", label: "Payments", icon: "\uD83D\uDCB3" },
    { id: "chats", label: "Chats", icon: "\uD83D\uDCAC" },
    { id: "ai", label: "AI Agents", icon: "\uD83E\uDD16" },
    { id: "content", label: "Content", icon: "\uD83D\uDCDD" },
  ];

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);

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
        <div className="flex gap-2 mb-8 rounded-xl bg-white/5 p-1 w-fit overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white" : "text-gray-400 hover:text-white"}`}>
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
                    <div key={stat.label} className="glass-card p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <span className="text-lg">{stat.icon}</span>
                      </div>
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <h2 className="text-lg font-display font-bold text-white mb-4">Quick Actions</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  <button onClick={() => setActiveTab("users")} className="glass-card p-4 text-left hover:bg-white/10 transition-all">
                    <p className="text-sm font-medium text-white">Manage Users</p>
                    <p className="text-xs text-gray-500 mt-1">View, edit roles, manage credits</p>
                  </button>
                  <button onClick={() => setActiveTab("ai")} className="glass-card p-4 text-left hover:bg-white/10 transition-all">
                    <p className="text-sm font-medium text-white">AI Agent Status</p>
                    <p className="text-xs text-gray-500 mt-1">Monitor 8 active agents</p>
                  </button>
                  <button onClick={() => setActiveTab("analytics")} className="glass-card p-4 text-left hover:bg-white/10 transition-all">
                    <p className="text-sm font-medium text-white">View Analytics</p>
                    <p className="text-xs text-gray-500 mt-1">Platform usage metrics</p>
                  </button>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === "analytics" && (
              <div>
                <h2 className="text-xl font-display font-bold text-gradient mb-6">Platform Analytics</h2>

                {/* Usage Metrics */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {[
                    { label: "Avg. Sessions/Day", value: "342", change: "+12%", positive: true },
                    { label: "Avg. Chat Length", value: "4.7 msgs", change: "+8%", positive: true },
                    { label: "Credit Consumption", value: "1,240/day", change: "+15%", positive: true },
                    { label: "API Response Time", value: "1.8s", change: "-5%", positive: true },
                    { label: "User Retention (7d)", value: "68%", change: "+3%", positive: true },
                    { label: "Conversion Rate", value: "4.2%", change: "-0.3%", positive: false },
                  ].map((m) => (
                    <div key={m.label} className="glass-card p-5">
                      <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                      <div className="flex items-end gap-2">
                        <p className="text-2xl font-bold text-white">{m.value}</p>
                        <span className={`text-xs font-medium mb-1 ${m.positive ? "text-emerald-400" : "text-red-400"}`}>{m.change}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feature Usage Breakdown */}
                <h3 className="text-lg font-display font-bold text-white mb-4">Feature Usage Breakdown</h3>
                <div className="glass-card p-6 mb-8">
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
                      <span className="text-sm text-gray-400 w-20">{f.feature}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${f.color} rounded-full transition-all`} style={{ width: `${f.pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-white w-10 text-right">{f.pct}%</span>
                    </div>
                  ))}
                </div>

                {/* Revenue Trend */}
                <h3 className="text-lg font-display font-bold text-white mb-4">Revenue Trend (Last 7 Days)</h3>
                <div className="glass-card p-6">
                  <div className="flex items-end gap-2 h-40">
                    {[4200, 3800, 5100, 4700, 6200, 5800, 7100].map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-gradient-to-t from-primary-600 to-mystic-500 rounded-t-lg transition-all" style={{ height: `${(val / 7100) * 100}%` }} />
                        <span className="text-[10px] text-gray-500">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                    <span className="text-sm text-gray-400">Weekly Total</span>
                    <span className="text-lg font-bold text-gradient">{formatCurrency(36900)}</span>
                  </div>
                </div>
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
                        {users.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>
                        )}
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

            {/* AI Agents Management */}
            {activeTab === "ai" && (
              <div>
                <h2 className="text-xl font-display font-bold text-gradient mb-6">AI Agent Management</h2>

                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  {aiAgents.map((agent) => (
                    <div key={agent.name} className="glass-card p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-bold text-white">{agent.name}</h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">{agent.status}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Category</span>
                          <span className="text-gray-300">{agent.category}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Model</span>
                          <span className="text-gray-300">{agent.model}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Total Queries</span>
                          <span className="text-gray-300">{agent.queries}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI Settings */}
                <h3 className="text-lg font-display font-bold text-white mb-4">AI Configuration</h3>
                <div className="glass-card p-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Default Model</label>
                      <select className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
                        <option>gpt-4o</option>
                        <option>gpt-4o-mini</option>
                        <option>gpt-4-turbo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Temperature</label>
                      <input type="number" defaultValue={0.7} min={0} max={2} step={0.1}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Max Tokens</label>
                      <input type="number" defaultValue={2048}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Chat History Depth</label>
                      <input type="number" defaultValue={10}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-4">Changes to AI configuration require a server restart to take effect. Update via environment variables.</p>
                </div>
              </div>
            )}

            {/* Content Management */}
            {activeTab === "content" && (
              <div>
                <h2 className="text-xl font-display font-bold text-gradient mb-6">Content Management</h2>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contentSections.map((section) => (
                    <div key={section.title} className="glass-card p-5">
                      <h3 className="font-display font-bold text-white mb-1">{section.title}</h3>
                      <p className="text-xs text-gray-400 mb-3">{section.desc}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <div>
                          <p className="text-lg font-bold text-gradient">{section.items}</p>
                          <p className="text-[10px] text-gray-500">items</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Last updated</p>
                          <p className="text-xs text-gray-300">{section.lastUpdated}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Content Actions */}
                <h3 className="text-lg font-display font-bold text-white mt-8 mb-4">Content Actions</h3>
                <div className="glass-card p-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Refresh Panchang Data</p>
                      <p className="text-xs text-gray-500">Update today&apos;s Tithi, Nakshatra, and timings</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Update Knowledge Base</p>
                      <p className="text-xs text-gray-500">Re-index RAG documents for AI agents</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Generate Weekly Horoscopes</p>
                      <p className="text-xs text-gray-500">Batch generate horoscopes for all 12 signs</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white mb-1">Export User Reports</p>
                      <p className="text-xs text-gray-500">Download CSV of all generated reports</p>
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
