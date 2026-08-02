import mongoose from 'mongoose';

// Admin-editable milestone table for the Retention Bonus — a sponsor's direct-team
// lifetime cumulative RENEWAL units (see investments.model.js's renewedFrom) are matched
// against these thresholds. No time window, unlike the Fast Start Bonus — retention is an
// ongoing incentive, not tied to a fixed clock.
const retentionBonusSlabSchema = new mongoose.Schema(
  {
    unitsThreshold: { type: Number, required: true, unique: true, min: 1 },
    bonusAmount: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

retentionBonusSlabSchema.index({ isActive: 1, unitsThreshold: 1 });

retentionBonusSlabSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('RetentionBonusSlab', retentionBonusSlabSchema);
