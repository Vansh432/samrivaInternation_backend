import mongoose from 'mongoose';

// Singleton config (one document, like Settings) — the official "Direct Acquisition Bonus":
// a sponsor earns this % of their DIRECT (level-1) referral's investment amount, rate
// depending on the referred investment's plan type. Uncapped, not rank-gated — separate from
// and in addition to Rank Income (see bonuses.service.js#evaluateDirectAcquisitionBonus).
const directAcquisitionBonusSchema = new mongoose.Schema(
  {
    compoundingPercent: { type: Number, default: 3, min: 0, max: 100 },
    monthlyIncomePercent: { type: Number, default: 2, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

directAcquisitionBonusSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('DirectAcquisitionBonusConfig', directAcquisitionBonusSchema);
