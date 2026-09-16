import mongoose from 'mongoose';

const adminChargeConfigSchema = new mongoose.Schema(
  {
    percentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

adminChargeConfigSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('AdminChargeConfig', adminChargeConfigSchema);