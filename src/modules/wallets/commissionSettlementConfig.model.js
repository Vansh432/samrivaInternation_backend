import mongoose from 'mongoose';

// One row per settlement period — commission EARNED between startDay and endDay (inclusive)
// of a calendar month gets released into the Commission wallet balance on `closingDay` of
// the FOLLOWING month (see wallets.service.js#settlePendingCommission). endDay: null means
// "through the end of the month" (only meaningful for the last period).
const periodSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true, min: 1, max: 4 },
    startDay: { type: Number, required: true, min: 1, max: 31 },
    endDay: { type: Number, min: 1, max: 31, default: null },
    closingDay: { type: Number, required: true, min: 1, max: 31 },
  },
  { _id: false }
);

// Singleton config (one document, like Settings) — the real periods the user specified,
// confirmed via worked example: 1-7 -> closes 8th, 8-14 -> closes 15th, 15-21 -> closes
// 22nd, 22-end -> closes 1st. All closing days admin-editable afterward.
const DEFAULT_PERIODS = [
  { order: 1, startDay: 1, endDay: 7, closingDay: 8 },
  { order: 2, startDay: 8, endDay: 14, closingDay: 15 },
  { order: 3, startDay: 15, endDay: 21, closingDay: 22 },
  { order: 4, startDay: 22, endDay: null, closingDay: 1 },
];

const commissionSettlementConfigSchema = new mongoose.Schema(
  {
    periods: { type: [periodSchema], default: () => DEFAULT_PERIODS },
  },
  { timestamps: true }
);

commissionSettlementConfigSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('CommissionSettlementConfig', commissionSettlementConfigSchema);
