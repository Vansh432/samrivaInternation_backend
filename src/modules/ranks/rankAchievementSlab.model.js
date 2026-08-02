import mongoose from 'mongoose';
import { RANKS } from '../../shared/constants/index.js';

// Admin-editable one-time reward for first reaching a rank — credited to the Reward wallet
// the moment a user's highestAchieved rank advances past this rank (see
// ranks.service.js#recalculateAllRanks). Unlike qualification/benefit slabs this never
// recurs per user — rank.highestAchieved only moves forward, so it doubles as the
// idempotency guard with no separate payout ledger needed.
const rankAchievementSlabSchema = new mongoose.Schema(
  {
    rank: { type: String, enum: Object.values(RANKS), required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

rankAchievementSlabSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('RankAchievementSlab', rankAchievementSlabSchema);
