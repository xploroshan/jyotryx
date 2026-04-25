/**
 * Runtime stub for `@prisma/client`. ts-jest resolves `@prisma/client`
 * to this module during unit tests so specs that import Prisma-typed
 * services don't trip over the missing generated client in CI / dev
 * environments where `prisma generate` hasn't run.
 *
 * PrismaClient is a no-op base so services like `PrismaService extends
 * PrismaClient` instantiate cleanly — each test replaces the injected
 * instance with `mockPrismaService()` anyway, so the real methods are
 * never called.
 */

export class PrismaClient {
  async $connect() { /* no-op */ }
  async $disconnect() { /* no-op */ }
  async $queryRaw() { return []; }
  async $queryRawUnsafe() { return []; }
  async $executeRaw() { return 0; }
  async $executeRawUnsafe() { return 0; }
  async $transaction(fn: any) {
    if (typeof fn === 'function') return fn(this);
    return fn;
  }
}

// Prisma enum exports used by source files (provider bootstrapping,
// role checks). These are runtime enums in the generated client;
// plain string constants are sufficient for tests.
export const Role = { USER: 'USER', PREMIUM: 'PREMIUM', ADMIN: 'ADMIN' };
export const AuthProvider = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
  PHONE: 'PHONE',
};
export const PlanType = { FREE: 'FREE', MONTHLY: 'MONTHLY', ANNUAL: 'ANNUAL' };
export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};
export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};
export const PaymentType = {
  CREDITS: 'CREDITS',
  SUBSCRIPTION: 'SUBSCRIPTION',
  REPORT: 'REPORT',
};
export const ReportType = {
  LIFE: 'LIFE', CAREER: 'CAREER', MARRIAGE: 'MARRIAGE',
  WEALTH: 'WEALTH', PALM: 'PALM', ANNUAL: 'ANNUAL',
};
export const ReportStatus = {
  GENERATING: 'GENERATING', READY: 'READY', FAILED: 'FAILED',
};
export const CreditTransactionType = {
  PURCHASE: 'PURCHASE',
  DAILY_FREE: 'DAILY_FREE',
  CHAT_DEDUCTION: 'CHAT_DEDUCTION',
  REPORT_PURCHASE: 'REPORT_PURCHASE',
};

// Matches the Prisma namespace export used for type-only imports.
// Runtime lookups on `Prisma.*` fall through to undefined, which is
// fine because nothing in the tested paths touches them.
export const Prisma: Record<string, unknown> = {};
