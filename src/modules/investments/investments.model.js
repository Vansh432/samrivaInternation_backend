import mongoose from 'mongoose';
import { PLAN_TYPES, PAYMENT_MODES, INVESTMENT_STATUS } from '../../shared/constants/index.js';

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
    // Proof of payment submitted at investment time — photo is optional only for cash
    // (enforced in investments.validation.js, not here, since it depends on paymentMode).
    // amountPaid is investor-reported (for admin reconciliation against transactionId/proof)
    // and may legitimately differ slightly from `principal` — never used in calculations.
    amountPaid: { type: Number, required: true, min: 1 },
    transactionId: { type: String, required: true, trim: true },
    paymentProofUrl: { type: String },
    certificateNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: Object.values(INVESTMENT_STATUS), default: INVESTMENT_STATUS.PENDING_VERIFICATION },
    // Both null while pending_verification — the tenure clock only starts once an admin
    // verifies the payment (see admin.service.js#approveInvestment).
    startDate: { type: Date, default: null },
    maturityDate: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    // Reused for both a rejection reason and any future hold-style message, same pattern
    // as User.kyc.rejectionReason.
    rejectionReason: { type: String },
    // How many monthly-income payouts have already been credited to the wallet — prevents
    // the returns cron from double-paying on re-runs (see scheduler/investmentReturns.cron.js).
    incomeCreditedMonths: { type: Number, default: 0 },
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
