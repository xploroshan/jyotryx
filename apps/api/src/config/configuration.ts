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

  database: {
    url: requireInProduction('DATABASE_URL', 'postgresql://localhost:5432/myastro360'),
    readReplicaUrl: process.env.DATABASE_READ_REPLICA_URL || '',
  },

  jwt: {
    secret: requireInProduction('JWT_SECRET', 'myastro360-dev-secret-change-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: requireInProduction('JWT_REFRESH_SECRET', 'myastro360-refresh-secret-change-in-production'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    // Razorpay subscription plan IDs (created once in the Razorpay
    // dashboard). The web /pricing page sends a logical plan
    // (MONTHLY | ANNUAL); the service maps it to the real plan_id here.
    planMonthly: process.env.RAZORPAY_PLAN_MONTHLY || '',
    planAnnual: process.env.RAZORPAY_PLAN_ANNUAL || '',
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
  },
});
