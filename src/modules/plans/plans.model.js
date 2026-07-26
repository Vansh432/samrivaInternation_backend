import mongoose from 'mongoose';

// One row = one entry of the official rate card (units range x tenure band),
// carrying both plan types' rates since they're always defined together for a given row.
const rateSlabSchema = new mongoose.Schema(
  {
    minUnits: { type: Number, required: true, min: 1 },
    maxUnits: { type: Number, default: null, min: 1 }, // null = "and above" (no upper bound)
    tenureMonths: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one tenure month is required',
      },
    },
    compoundingRatePercent: { type: Number, required: true, min: 0, max: 100 }, // "Growth %age"
    monthlyIncomeRatePercent: { type: Number, required: true, min: 0, max: 100 }, // "Income %age"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

rateSlabSchema.index({ isActive: 1, minUnits: 1 });

rateSlabSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('RateSlab', rateSlabSchema);
