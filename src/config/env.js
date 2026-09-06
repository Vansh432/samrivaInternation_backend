import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongodbUrl: process.env.MONGODB_URL,
  mail: {
    host: process.env.SMTP_HOST || process.env.MAIL_HOST || process.env.EMAIL_HOST,
    port: Number(process.env.SMTP_PORT || process.env.MAIL_PORT || process.env.EMAIL_PORT || 587),
    secure: (process.env.SMTP_SECURE || process.env.MAIL_SECURE || process.env.EMAIL_SECURE) === 'true',
    user: process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER,
    password: process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || process.env.EMAIL_PASSWORD,
    from: process.env.FROM_MAIL || process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },
  // TESTING MODE ONLY — bypasses KYC gates, disables the real cron schedule, and auto-runs
  // cron-equivalent processing inline on relevant API hits. See middleware/testingAutoProcess.js,
  // server.js, auth.service.js, and investments.service.js for every place this is checked.
  // Remove TESTING_MODE from .env (or set to false) to fully revert, then strip these checks.
  testingMode: process.env.TESTING_MODE === 'true',
  // Shared secret checked by middleware/cronAuth.js — lets an external scheduler (GitHub
  // Actions, see .github/workflows/cron.yml) trigger POST /api/cron/run over plain HTTP,
  // which both wakes a sleeping Render free-tier instance and runs the actual cron jobs
  // (node-cron alone can't fire while Render has put the process to sleep).
  cronSecret: process.env.CRON_SECRET,
};
