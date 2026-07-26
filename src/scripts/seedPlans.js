// One-off dev utility: seeds the official investment rate card (units range x tenure band)
// shown in the compensation plan. Safe to re-run: skips rows that already exist.
// Run with: node src/scripts/seedPlans.js
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import { logger } from '../config/logger.js';
import RateSlab from '../modules/plans/plans.model.js';

const SHORT_TENURES = [6, 12, 18];
const LONG_TENURES = [24, 30, 36];

const RATE_CARD = [
  { minUnits: 1, maxUnits: 4, tenureMonths: SHORT_TENURES, compoundingRatePercent: 3.5, monthlyIncomeRatePercent: 2.5 },
  { minUnits: 1, maxUnits: 4, tenureMonths: LONG_TENURES, compoundingRatePercent: 4, monthlyIncomeRatePercent: 3 },
  { minUnits: 5, maxUnits: 16, tenureMonths: SHORT_TENURES, compoundingRatePercent: 4.5, monthlyIncomeRatePercent: 3.5 },
  { minUnits: 5, maxUnits: 16, tenureMonths: LONG_TENURES, compoundingRatePercent: 5, monthlyIncomeRatePercent: 4 },
  { minUnits: 17, maxUnits: 50, tenureMonths: SHORT_TENURES, compoundingRatePercent: 5, monthlyIncomeRatePercent: 4 },
  { minUnits: 17, maxUnits: 50, tenureMonths: LONG_TENURES, compoundingRatePercent: 5.5, monthlyIncomeRatePercent: 4.5 },
  { minUnits: 51, maxUnits: 150, tenureMonths: SHORT_TENURES, compoundingRatePercent: 5.5, monthlyIncomeRatePercent: 4.5 },
  { minUnits: 51, maxUnits: 150, tenureMonths: LONG_TENURES, compoundingRatePercent: 6, monthlyIncomeRatePercent: 5 },
  { minUnits: 151, maxUnits: 450, tenureMonths: SHORT_TENURES, compoundingRatePercent: 6, monthlyIncomeRatePercent: 5 },
  { minUnits: 151, maxUnits: 450, tenureMonths: LONG_TENURES, compoundingRatePercent: 6.5, monthlyIncomeRatePercent: 5.5 },
  { minUnits: 451, maxUnits: null, tenureMonths: SHORT_TENURES, compoundingRatePercent: 6.5, monthlyIncomeRatePercent: 5.5 },
  { minUnits: 451, maxUnits: null, tenureMonths: LONG_TENURES, compoundingRatePercent: 7, monthlyIncomeRatePercent: 6 },
];

const run = async () => {
  await connectDB();

  let created = 0;
  let skipped = 0;

  for (const row of RATE_CARD) {
    const existing = await RateSlab.findOne({
      minUnits: row.minUnits,
      maxUnits: row.maxUnits,
      tenureMonths: row.tenureMonths,
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await RateSlab.create(row);
    created += 1;
  }

  logger.info('seed.plans.done', { created, skipped });
  console.log(`\nRate card seeded: ${created} created, ${skipped} already existed.\n`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  logger.error('seed.plans.failed', { error: err.message });
  console.error(err);
  process.exit(1);
});
