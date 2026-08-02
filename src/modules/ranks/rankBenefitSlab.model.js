import mongoose from 'mongoose';
import { RANKS } from '../../shared/constants/index.js';

// Admin-editable monthly perk bonuses for one non-investor rank — each amount is credited
// to the Reward wallet when the user's direct/level-one team's monthly business meets
// qualifyingDirectUnitsPerMonth. 0 on any bonus field means "N/a" for that rank (skipped).
// See ranks.service.js#evaluateMonthlyRankBenefits for how these are evaluated.
const rankBenefitSlabSchema = new mongoose.Schema(
  {
    rank: { type: String, enum: Object.values(RANKS), required: true, unique: true },
    mobileBonus: { type: Number, default: 0, min: 0 },
    groomingBonus: { type: Number, default: 0, min: 0 },
    conveyanceBonus: { type: Number, default: 0, min: 0 },
    lifeStyleBonus: { type: Number, default: 0, min: 0 },
    businessTourBonus: { type: Number, default: 0, min: 0 },
    familyTripBonus: { type: Number, default: 0, min: 0 },
    qualifyingDirectUnitsPerMonth: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

rankBenefitSlabSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('RankBenefitSlab', rankBenefitSlabSchema);
