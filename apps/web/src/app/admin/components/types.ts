export interface DashboardStats {
  totalUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  totalChats: number;
  totalKundlis: number;
  totalPayments: number;
  newUsersToday: number;
  activeSubscriptions: number;
}

export interface UserItem {
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

export interface UserDetail {
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

export interface PlatformAnalytics {
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

export interface LlmCostRow {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  calls: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface ContentStats {
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

export interface ActivityLog {
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
