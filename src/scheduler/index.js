import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { processInvestmentReturns } from './investmentReturns.cron.js';
import { processRankRecalculation } from './rankRecalculation.cron.js';
import { processRankBenefits } from './rankBenefits.cron.js';
import { processFastStartSettlement } from './fastStartSettlement.cron.js';
import { processOverrideSettlement } from './overrideSettlement.cron.js';
import { processCommissionSettlement } from './commissionSettlement.cron.js';

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

  // Daily at 04:00 — settles any sponsor whose Fast Start 30-day window closed since the
  // last run (see bonuses.service.js#settleFastStartBonuses). Independent of the jobs above,
  // just placed after them by convention.
  cron.schedule('0 4 * * *', async () => {
    try {
      const result = await processFastStartSettlement();
      logger.info('cron.fastStartSettlement.completed', result);
    } catch (err) {
      logger.error('cron.fastStartSettlement.failed', { error: err.message });
    }
  });

  // 05:00 on the 1st of each month — after Rank Benefits above, settling Leadership
  // Override for the calendar month that just closed (see
  // overrides.service.js#settleLeadershipOverrides: pays each user a % of their own
  // generation-1/2/3 upline's Commission wallet total for that month).
  cron.schedule('0 5 1 * *', async () => {
    try {
      const result = await processOverrideSettlement();
      logger.info('cron.overrideSettlement.completed', result);
    } catch (err) {
      logger.error('cron.overrideSettlement.failed', { error: err.message });
    }
  });

  // Daily at 06:00 — checks whether today matches one of the 4 admin-configured Commission
  // settlement closing days, and if so releases every still-pending Commission-wallet
  // credit (Rank Income, Direct Acquisition Bonus) earned in the corresponding period of
  // the month that just ended (see wallets.service.js#settlePendingCommission). A no-op on
  // every other day.
  cron.schedule('0 6 * * *', async () => {
    try {
      const result = await processCommissionSettlement();
      logger.info('cron.commissionSettlement.completed', result);
    } catch (err) {
      logger.error('cron.commissionSettlement.failed', { error: err.message });
    }
  });

  logger.info('Cron jobs scheduled');
};
