import mongoose from 'mongoose';
import { RANKS } from '../../shared/constants/index.js';

// Admin-editable qualification criteria for one non-investor rank. A user qualifies when
// their own active units, direct-team size (of referrals at requiredDirectRank or above),
// and (optionally) that team's combined units all meet these minimums — see
// ranks.service.js#recalculateAllRanks for how these are evaluated.
const rankSlabSchema = new mongoose.Schema(
  {
    rank: { type: String, enum: Object.values(RANKS), required: true, unique: true },
    selfUnitsMin: { type: Number, required: true, min: 0 },
    directTeamSizeMin: { type: Number, required: true, min: 0 },
    requiredDirectRank: { type: String, enum: Object.values(RANKS), required: true },
    // 0 = no combined-units requirement for this rank (e.g. Senior Manager and above).
    teamBusinessUnitMin: { type: Number, default: 0, min: 0 },
    // Rank Income % — this rank's slot in the 7-level income table (see
    // ranks.service.js#evaluateRankIncome). No `default` on purpose: an absent value here
    // (pre-existing rows from before this field existed) is how ensureRankIncomePercents()
    // detects rows that still need the one-time backfill.
    incomePercent: { type: Number, min: 0, max: 100 },
    // How many team levels deep this rank's Retention Bonus counts renewal units from
    // (cumulative — e.g. 3 means levels 1+2+3 all count; 0 = doesn't earn Retention Bonus).
    // See bonuses.service.js#evaluateMonthlyRetentionBonus. Same no-default-on-purpose
    // backfill pattern as incomePercent above — ensureRetentionLevelsUnlocked() fills gaps.
    retentionLevelsUnlocked: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

rankSlabSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('RankSlab', rankSlabSchema);
