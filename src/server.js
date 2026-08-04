import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/database.js';
import { logger } from './config/logger.js';
import { startCronJobs } from './scheduler/index.js';
import {
  ensureDefaultRankSlabs,
  ensureDefaultRankBenefitSlabs,
  ensureRankIncomePercents,
  ensureDefaultRankAchievementSlabs,
} from './modules/ranks/ranks.service.js';
import { ensureDefaultRetentionSlabs } from './modules/bonuses/bonuses.service.js';
import { ensureDefaultOverrideSlabs } from './modules/overrides/overrides.service.js';

const start = async () => {
  await connectDB();
  await ensureDefaultRankSlabs();
  await ensureRankIncomePercents();
  await ensureDefaultRankBenefitSlabs();
  await ensureDefaultRankAchievementSlabs();
  await ensureDefaultRetentionSlabs();
  await ensureDefaultOverrideSlabs();

  // TESTING MODE ONLY — see env.js#testingMode. The real 1/2/3 AM cron schedule is disabled
  // so it can't double-process alongside the inline auto-processing middleware (see app.js).
  // Remove this `if` (always call startCronJobs()) to restore normal cron behavior.
  if (!env.testingMode) {
    startCronJobs();
  } else {
    logger.warn('TESTING MODE enabled — cron schedule disabled, KYC gates bypassed, inline auto-processing active on investments/ranks routes');
  }

  app.listen(env.port, () => {
    logger.info(`Server is running on port ${env.port}`);
  });
};

start();
