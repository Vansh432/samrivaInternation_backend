import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import { logger } from '../../config/logger.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { processInvestmentReturns } from '../../scheduler/investmentReturns.cron.js';
import { processRankRecalculation } from '../../scheduler/rankRecalculation.cron.js';
import { processRankBenefits } from '../../scheduler/rankBenefits.cron.js';
import { processFastStartSettlement } from '../../scheduler/fastStartSettlement.cron.js';
import { processOverrideSettlement } from '../../scheduler/overrideSettlement.cron.js';
import { processCommissionSettlement } from '../../scheduler/commissionSettlement.cron.js';

// Every job below already checks its own "is it actually due yet" condition internally
// (rank benefits / override settlement / commission settlement all key off getMonthRange or
// a configured closing day; fast start settlement checks each sponsor's own window) — so
// this is safe to call as often as the external scheduler pings it. A job that isn't due
// yet just returns its own no-op result instead of doing anything.
const JOBS = {
  investmentReturns: processInvestmentReturns,
  rankRecalculation: processRankRecalculation,
  rankBenefits: processRankBenefits,
  fastStartSettlement: processFastStartSettlement,
  overrideSettlement: processOverrideSettlement,
  commissionSettlement: processCommissionSettlement,
};

// One job failing must never block the others — same best-effort try/catch pattern used
// everywhere else in this app for independent side effects.
export const runAll = asyncHandler(async (req, res) => {
  const results = {};
  const failedJobs = [];

  for (const [name, fn] of Object.entries(JOBS)) {
    try {
      results[name] = await fn();
    } catch (err) {
      results[name] = { error: err.message };
      failedJobs.push(name);
      logger.error(`cron.http.${name}.failed`, { error: err.message });
    }
  }

  logger.info('cron.http.runAll.completed', results);

  // Winston's file logs don't survive a Render restart/redeploy — this is the durable,
  // queryable record (visible in the admin Activity Logs page) that GitHub Actions'
  // scheduled ping actually reached the backend and ran every job. See
  // .github/workflows/cron.yml (in this repo's own root, not the outer monorepo — this repo
  // is what Render deploys) for the caller.
  await logEvent({
    type: 'cron',
    action: 'cron.http.triggered',
    level: failedJobs.length ? 'warn' : 'info',
    message: failedJobs.length
      ? `Cron run triggered via GitHub Actions — ${failedJobs.length} of ${Object.keys(JOBS).length} job(s) failed (${failedJobs.join(', ')})`
      : `Cron run triggered via GitHub Actions — all ${Object.keys(JOBS).length} jobs executed`,
    meta: { results, failedJobs, triggeredBy: 'github-actions', ip: req.ip },
  });

  return sendSuccess(res, { message: 'Cron jobs executed', data: results });
});
