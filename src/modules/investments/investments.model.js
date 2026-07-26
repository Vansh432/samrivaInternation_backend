import mongoose from 'mongoose';
import { PLAN_TYPES, PAYMENT_MODES } from '../../shared/constants/index.js';

const investmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planType: { type: String, enum: Object.values(PLAN_TYPES), required: true },
    units: { type: Number, required: true, min: 1 },
    tenureMonths: { type: Number, required: true, min: 1 },
    // Locked in at purchase time — later admin changes to the unit price or rate table
    // must never retroactively affect an existing investment's numbers.
    unitValueInr: { type: Number, required: true },
    principal: { type: Number, required: true },
    ratePercent: { type: Number, required: true },
    paymentMode: { type: String, enum: Object.values(PAYMENT_MODES), required: true },
    certificateNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'matured', 'cancelled'], default: 'active' },
    startDate: { type: Date, required: true, default: Date.now },
    maturityDate: { type: Date, required: true },
  },
  { timestamps: true }
);

investmentSchema.index({ user: 1, createdAt: -1 });

investmentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Investment', investmentSchema);
