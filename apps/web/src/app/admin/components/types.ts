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
  /** Lifetime credits consumed (sum of negative `credit_transactions`).
   *  "Given" is derived as `credits + creditsUsed` for the table row. */
  creditsUsed: number;
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
  creditsByFeature: Array<{ feature: string; totalCredits: number; count: number }>;
}

export interface PlatformAnalytics {
  sessionsToday: number;
  sessionsLast7Days: number;
  avgSessionsPerDay: number;
  avgChatLength: number;
  creditsConsumedToday: number;
  creditsConsumedLast7Days: number;
  creditsByFeatureLast7Days: Array<{ feature: string; totalCredits: number; count: number }>;
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

// ─── Phase 2 growth & retention ─────────────────────────────────────────

export interface FunnelStage {
  stage: "signup" | "profile_complete" | "first_chat" | "first_payment" | "renewal";
  label: string;
  count: number;
  conversionFromPrev: number;
  conversionFromSignup: number;
}

export interface FunnelCounts {
  windowDays: number;
  locale: string | null;
  totalSignups: number;
  stages: FunnelStage[];
}

export interface CohortRow {
  cohortWeek: string;
  size: number;
  retention: number[];
}

export interface MrrSnapshot {
  mrrUsd: number;
  arrUsd: number;
  momDelta: number;
  projection6m: number;
  asOf: string | null;
  totalRevenueUsd: number;
  subscriberCount: number;
  arpuUsd: number;
  ltvUsd: number;
}

export interface ChurnRiskRow {
  userId: string;
  email: string;
  name: string;
  subscriptionId: string | null;
  plan: string | null;
  endDate: string | null;
  lastChatAt: string | null;
  daysSinceLastChat: number | null;
  reason: "inactive" | "payment_fail";
  recentFailedPayments?: number;
}

export interface PaymentFailureRow {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

// ─── Phase 3 ops health + kill-switch + broadcast ───────────────────────

export interface LlmErrorRateRow {
  provider: string;
  total: number;
  errors: number;
  errorRate: number;
  topErrors: Array<{ errorCode: string; count: number }>;
}

export interface LatencyBucket {
  key: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface CacheHitRow {
  feature: string;
  total: number;
  hits: number;
  hitRate: number;
}

export interface QueueDepthRow {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface ServiceHealth {
  database: "up" | "down";
  redis: "up" | "down";
  details: Record<string, string | number>;
}

export interface OpsLlmHealthResponse {
  errorRate: LlmErrorRateRow[];
  latencyByFeature: LatencyBucket[];
  latencyByProvider: LatencyBucket[];
  cacheHitRate: CacheHitRow[];
}

export type BroadcastAudience =
  | { type: "all" }
  | { type: "premium" }
  | { type: "locale"; locale: string };

export interface BroadcastRequest {
  audience: BroadcastAudience;
  subject: string;
  body: string;
  channel: "inapp" | "email" | "push";
  notificationType?: "horoscope" | "panchang" | "reminder" | "promotion" | "system";
}

// ─── Phase 4 safety + GDPR + forecasts ──────────────────────────────────

export type FlaggedStatus = "pending" | "approved" | "hidden" | "actioned";
export type ResolveAction = "approve" | "hide" | "actioned";

export interface FlaggedMessageRow {
  id: string;
  messageId: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  categories: string[];
  scores: Record<string, number>;
  status: FlaggedStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  preview: string | null;
}

export type GdprStatus = "pending" | "fulfilled" | "rejected";
export type GdprType = "export" | "delete";

export interface GdprRequestRow {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  type: GdprType;
  status: GdprStatus;
  dueBy: string;
  daysUntilDue: number;
  fulfilledAt: string | null;
  adminId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CostForecastPoint {
  date: string;
  actualUsd: number | null;
  predictedUsd: number | null;
  lowerUsd: number | null;
  upperUsd: number | null;
}

export interface CostForecast {
  points: CostForecastPoint[];
  level: number;
  trend: number;
  residualStd: number;
}

export interface CapacityForecast {
  provider: string;
  tpmLimit: number | null;
  currentPeakTpm: number;
  slopePerDay: number;
  daysUntilHit: number | null;
}
