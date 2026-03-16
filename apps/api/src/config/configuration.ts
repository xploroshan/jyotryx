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
    url: requireInProduction('DATABASE_URL', 'postgresql://localhost:5432/jyotryx'),
  },

  jwt: {
    secret: requireInProduction('JWT_SECRET', 'jyotryx-dev-secret-change-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: requireInProduction('JWT_REFRESH_SECRET', 'jyotryx-refresh-secret-change-in-production'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },

  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '5', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  credits: {
    freeMonthly: parseInt(process.env.FREE_MONTHLY_CREDITS || '10', 10),
    chatCost: parseInt(process.env.CHAT_CREDIT_COST || '1', 10),
    kundliCost: parseInt(process.env.KUNDLI_CREDIT_COST || '2', 10),
    reportCost: parseInt(process.env.REPORT_CREDIT_COST || '5', 10),
    palmistryCost: parseInt(process.env.PALMISTRY_CREDIT_COST || '3', 10),
  },
});
