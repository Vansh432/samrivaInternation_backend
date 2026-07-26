import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { processInvestmentReturns } from './investmentReturns.cron.js';

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

  logger.info('Cron jobs scheduled');
};
