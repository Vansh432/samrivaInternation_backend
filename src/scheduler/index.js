import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { processInvestmentReturns } from './investmentReturns.cron.js';
import { processRankRecalculation } from './rankRecalculation.cron.js';
import { processRankBenefits } from './rankBenefits.cron.js';

export const startCronJobs = () => {
  // Daily at 01:00 — enough resolution for a monthly-granularity product; reuses the same
  // elapsed-months formula the app displays everywhere, so paid-out amounts and on-screen
  // projections never disagree.
  cron.schedule('0 1 * * *', async () => {
    try {
      const result = await processInvestmentReturns();
      logger.info('cron.investmentReturns.completed', result);
    } catch (err) {
      logger.error('cron.investmentReturns.failed', { error: err.message });
    }
  });

  // Daily at 02:00 — after the investment-returns run above, so same-day approvals/
  // maturities are already reflected when ranks are recalculated.
  cron.schedule('0 2 * * *', async () => {
    try {
      const result = await processRankRecalculation();
      logger.info('cron.rankRecalculation.completed', result);
    } catch (err) {
      logger.error('cron.rankRecalculation.failed', { error: err.message });
    }
  });

  // 03:00 on the 1st of each month — after the nightly jobs above, evaluating the calendar
  // month that just closed so every user's rank/investment state for that month is final.
  cron.schedule('0 3 1 * *', async () => {
    try {
      const result = await processRankBenefits();
      logger.info('cron.rankBenefits.completed', result);
    } catch (err) {
      logger.error('cron.rankBenefits.failed', { error: err.message });
    }
  });

  logger.info('Cron jobs scheduled');
};
