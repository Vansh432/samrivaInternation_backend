import mongoose from 'mongoose';

// Admin-editable percentage table for the Leadership Override Bonus — generation 1/2/3
// above an investor's direct sponsor, each earning `percent`% of the investment amount if
// that generation currently outranks the sponsor (see overrides.service.js#evaluateLeadershipOverride).
const leadershipOverrideSlabSchema = new mongoose.Schema(
  {
    generation: { type: Number, required: true, unique: true, min: 1, max: 3 },
    percent: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

leadershipOverrideSlabSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('LeadershipOverrideSlab', leadershipOverrideSlabSchema);
