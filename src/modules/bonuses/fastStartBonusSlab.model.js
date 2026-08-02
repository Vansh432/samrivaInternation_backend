import mongoose from 'mongoose';

// Admin-editable milestone table for the Fast Start Bonus — a sponsor's direct-team
// cumulative units within their 30-day window are matched against these thresholds.
const fastStartBonusSlabSchema = new mongoose.Schema(
  {
    unitsThreshold: { type: Number, required: true, unique: true, min: 1 },
    bonusAmount: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

fastStartBonusSlabSchema.index({ isActive: 1, unitsThreshold: 1 });

fastStartBonusSlabSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('FastStartBonusSlab', fastStartBonusSlabSchema);
