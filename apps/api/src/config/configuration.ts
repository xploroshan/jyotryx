const isProduction = process.env.NODE_ENV === 'production';

function requireInProduction(key: string, fallback: string): string {
  const value = process.env[key];
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || fallback;
}

export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    url: requireInProduction('DATABASE_URL', 'postgresql://localhost:5432/jyotron'),
    readReplicaUrl: process.env.DATABASE_READ_REPLICA_URL || '',
  },

  jwt: {
    secret: requireInProduction('JWT_SECRET', 'jyotron-dev-secret-change-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: requireInProduction('JWT_REFRESH_SECRET', 'jyotron-refresh-secret-change-in-production'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
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
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '5', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
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
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || 'jyotryx-uploads',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },

  data: {
    retentionMonths: parseInt(process.env.DATA_RETENTION_MONTHS || '6', 10),
  },

  analytics: {
    clickhouseUrl: process.env.CLICKHOUSE_URL || '',
  },

  credits: {
    freeMonthly: parseInt(process.env.FREE_MONTHLY_CREDITS || '10', 10),
    chatCost: parseInt(process.env.CHAT_CREDIT_COST || '1', 10),
    kundliCost: parseInt(process.env.KUNDLI_CREDIT_COST || '2', 10),
    reportCost: parseInt(process.env.REPORT_CREDIT_COST || '5', 10),
    palmistryCost: parseInt(process.env.PALMISTRY_CREDIT_COST || '3', 10),
  },
});
