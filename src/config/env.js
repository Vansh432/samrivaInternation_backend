import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongodbUrl: process.env.MONGODB_URL,
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
};
