import mongoose from 'mongoose';
import { RANKS } from '../../shared/constants/index.js';

// One row per user per evaluated calendar month — records what the monthly rank-benefit
// evaluation decided, and doubles as the idempotency guard (unique user+yearMonth) so a
// rerun of the cron never pays the same month twice.
const rankBenefitPayoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rank: { type: String, enum: Object.values(RANKS), required: true },
    // The calendar month whose direct-team business was evaluated, e.g. '2026-07'.
    yearMonth: { type: String, required: true },
    directUnits: { type: Number, required: true },
    qualifyingUnitsRequired: { type: Number, required: true },
    bonusesPaid: [
      {
        type: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
  },
  { timestamps: true }
);

rankBenefitPayoutSchema.index({ user: 1, yearMonth: 1 }, { unique: true });

rankBenefitPayoutSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('RankBenefitPayout', rankBenefitPayoutSchema);
