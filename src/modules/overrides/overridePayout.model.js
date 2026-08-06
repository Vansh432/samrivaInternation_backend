import mongoose from 'mongoose';

// One row per (receiving user, generation, calendar month) — idempotency guard + audit
// trail for the monthly Leadership Override settlement (see
// overrides.service.js#settleLeadershipOverrides). `user` is who got paid; `sourceUser` is
// the generation-N ancestor whose Commission wallet total that month was the payout base.
const overridePayoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    generation: { type: Number, required: true, min: 1, max: 3 },
    sourceUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The calendar month whose commission was evaluated, e.g. '2026-07'.
    yearMonth: { type: String, required: true },
    percent: { type: Number, required: true },
    commissionBase: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

overridePayoutSchema.index({ user: 1, generation: 1, yearMonth: 1 }, { unique: true });

overridePayoutSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('OverridePayout', overridePayoutSchema);
