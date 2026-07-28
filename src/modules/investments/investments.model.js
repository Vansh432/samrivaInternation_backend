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
    // The matched rate slab's unit range at purchase time (e.g. 17-50 units) — shown on the
    // certificate; a later slab edit must never retroactively change what an existing
    // certificate says, so this is captured once, not looked up live.
    unitRangeMin: { type: Number },
    unitRangeMax: { type: Number },
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
    // Certificate-only fields, all set once at approval alongside startDate/maturityDate
    // (see admin.service.js#approveInvestment) — kept as their own fields rather than reusing
    // startDate/maturityDate directly so an early/partial redemption can later diverge from
    // the originally scheduled maturity without losing what was printed on the certificate.
    dateOfAllotment: { type: Date, default: null },
    redemptionDate: { type: Date, default: null },
    // Sequential range reserved from the shared debenture-number counter, sized by `units`
    // (see shared/utils/sequence.js) — e.g. units=20 reserves D000001-D000020.
    debentureNoStart: { type: String },
    debentureNoEnd: { type: String },
    certificatePdfUrl: { type: String },
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
