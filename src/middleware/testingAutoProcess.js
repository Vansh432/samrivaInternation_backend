import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// TESTING MODE ONLY — see config/env.js#testingMode. Runs the given cron-equivalent job
// functions inline before every request to the mounted route group, so results always
// reflect "as of right now" instead of waiting for the disabled 1/2/3 AM schedule (see
// server.js). Delete this file and its two mount points in app.js to fully revert.
export const testingAutoProcess = (jobFns) => async (req, res, next) => {
  if (!env.testingMode) return next();
  try {
    for (const fn of jobFns) await fn();
  } catch (err) {
    logger.error('testingMode.autoProcess.failed', { error: err.message, path: req.path });
  }
  next();
};
