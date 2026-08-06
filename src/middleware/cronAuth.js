import { env } from '../config/env.js';

// Machine-to-machine auth for POST /api/cron/run — a static shared secret, not a user JWT,
// since the caller is GitHub Actions (see .github/workflows/cron.yml), not a logged-in user.
export const verifyCronSecret = (req, res, next) => {
  const provided = req.headers['x-cron-secret'];
  if (!env.cronSecret || !provided || provided !== env.cronSecret) {
    return res.status(401).json({ status: false, message: 'Invalid or missing cron secret', errors: [] });
  }
  next();
};
