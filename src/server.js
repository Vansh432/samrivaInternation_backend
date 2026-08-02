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
  startCronJobs();

  app.listen(env.port, () => {
    logger.info(`Server is running on port ${env.port}`);
  });
};

start();
