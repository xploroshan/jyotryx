const isProduction = process.env.NODE_ENV === 'production';

function requireInProduction(key: string, fallback: string): string {
  const value = process.env[key];
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || fallback;
}

/**
 * Parse a numeric env var safely. The previous pattern —
 * `parseInt(process.env.X || 'default', 10)` — only catches
 * `undefined`/`""`. If the variable is set to a non-numeric string
 * (e.g. an API key got pasted into the wrong slot in Railway),
 * `parseInt` returns `NaN`, the `||` fallback never fires, and the
 * downstream code silently breaks: `WHERE credits >= NaN` evaluates
 * to `NULL` in Postgres so deductCredits returns false → user sees
 * "Insufficient credits" with no clue why. Same shape can corrupt
 * `port`, `redis.port`, OTP settings, etc.
 *
 * This helper falls back to the default whenever the env var is
 * missing, empty, or fails to parse to a finite number, and warns
 * loudly so the operator notices the bad value at boot time.
 */
function parseIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] env "${key}"=${JSON.stringify(raw)} is not a valid integer; ` +
        `falling back to ${fallback}. Fix the variable in your deployment platform.`,
    );
    return fallback;
  }
  return n;
}

export default () => ({
  port: parseIntEnv('PORT', 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  // Public, internet-reachable base URL of THIS API (including the `/api`
  // prefix), used to build the Cashfree `notify_url` webhook target. Must be
  // HTTPS in production. When unset we omit the per-order notify_url and rely
  // on the webhook configured globally in the Cashfree dashboard.
  apiUrl: process.env.API_PUBLIC_URL || process.env.PUBLIC_API_URL || '',

  database: {
    url: requireInProduction('DATABASE_URL', 'postgresql://localhost:5432/myastro360'),
    readReplicaUrl: process.env.DATABASE_READ_REPLICA_URL || '',
  },

  jwt: {
    secret: requireInProduction('JWT_SECRET', 'myastro360-dev-secret-change-in-production'),
    // Short access-token TTL: access JWTs are stateless and can't be revoked,
    // so a force-logout (which revokes the refresh family) only fully bites
    // once the access token expires. 15m bounds that window; the web client
    // auto-refreshes on 401 so sessions stay seamless.
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: requireInProduction('JWT_REFRESH_SECRET', 'myastro360-refresh-secret-change-in-production'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  cashfree: {
    clientId: process.env.CASHFREE_CLIENT_ID || '',
    clientSecret: process.env.CASHFREE_CLIENT_SECRET || '',
    // Cashfree signs webhooks with the client secret by default. A separate
    // dashboard-configured webhook secret can be supplied here; the service
    // falls back to `clientSecret` when this is empty.
    webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || '',
    // 'sandbox' (default) or 'production'. Drives the API base URL and is the
    // only Cashfree value the web client is told (NEXT_PUBLIC_CASHFREE_MODE).
    mode: process.env.CASHFREE_ENV || 'sandbox',
    // Pin the API contract version explicitly — Cashfree changes payload
    // shapes across versions, so we never want the "latest" implicit default.
    apiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
    // Cashfree subscription plan IDs (created once in the Cashfree dashboard).
    // The web /pricing page sends a logical plan (MONTHLY | ANNUAL); the
    // service maps it to the real plan_id here.
    planMonthly: process.env.CASHFREE_PLAN_MONTHLY || '',
    planAnnual: process.env.CASHFREE_PLAN_ANNUAL || '',
    // Max allowed clock skew (seconds) between the signed webhook timestamp
    // and now, before the delivery is rejected as a possible replay.
    webhookToleranceSeconds: parseIntEnv('CASHFREE_WEBHOOK_TOLERANCE_SECONDS', 300),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    modelPrecision: process.env.OPENAI_MODEL_PRECISION || 'gpt-4o',
    modelVision: process.env.OPENAI_MODEL_VISION || 'gpt-4o-mini',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    modelVision: process.env.GEMINI_MODEL_VISION || 'gemini-2.0-flash',
  },

  llm: {
    failoverEnabled: process.env.LLM_FAILOVER_ENABLED || 'true',
  },

  otp: {
    expiresInMinutes: parseIntEnv('OTP_EXPIRES_IN_MINUTES', 5),
    length: parseIntEnv('OTP_LENGTH', 6),
    // Per-phone wrong-guess cap before the current OTP is burned (brute-force guard).
    maxVerifyAttempts: parseIntEnv('OTP_MAX_VERIFY_ATTEMPTS', 5),
    // When true, the /auth/otp/send response includes the OTP (dev/staging only).
    // Automatically enabled outside production unless explicitly disabled.
    exposeOtpInResponse:
      process.env.OTP_EXPOSE_IN_RESPONSE === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.OTP_EXPOSE_IN_RESPONSE !== 'false'),
  },

  sms: {
    provider: process.env.SMS_PROVIDER || '', // 'twilio' | '' (disabled)
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromPhone: process.env.TWILIO_FROM_PHONE || '',
    },
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseIntEnv('REDIS_PORT', 6379),
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || 'myastro360-uploads',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },

  data: {
    retentionMonths: parseIntEnv('DATA_RETENTION_MONTHS', 6),
  },

  analytics: {
    clickhouseUrl: process.env.CLICKHOUSE_URL || '',
  },

  credits: {
    freeMonthly: parseIntEnv('FREE_MONTHLY_CREDITS', 10),
    chatCost: parseIntEnv('CHAT_CREDIT_COST', 1),
    kundliCost: parseIntEnv('KUNDLI_CREDIT_COST', 2),
    reportCost: parseIntEnv('REPORT_CREDIT_COST', 5),
    palmistryCost: parseIntEnv('PALMISTRY_CREDIT_COST', 3),
    deepDiveCost: parseIntEnv('DEEP_DIVE_CREDIT_COST', 3),
  },
});
