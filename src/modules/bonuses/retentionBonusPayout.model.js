import mongoose from 'mongoose';

// One row per user per evaluated calendar month — records what the monthly Retention Bonus
// evaluation decided, and doubles as the idempotency guard (unique user+yearMonth) so a
// rerun of the cron never pays the same month twice. Mirrors rankBenefitPayout.model.js.
const retentionBonusPayoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The calendar month whose renewal volume was evaluated, e.g. '2026-08'.
    yearMonth: { type: String, required: true },
    levelsUsed: { type: Number, required: true },
    renewedUnits: { type: Number, required: true },
    unitsThreshold: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

retentionBonusPayoutSchema.index({ user: 1, yearMonth: 1 }, { unique: true });

retentionBonusPayoutSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('RetentionBonusPayout', retentionBonusPayoutSchema);
