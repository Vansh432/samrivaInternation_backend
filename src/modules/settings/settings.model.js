import mongoose from 'mongoose';

// Singleton document — one row holds all global platform settings (extend with more
// fields here as new dynamic settings are needed, e.g. TDS %, lock-in months).
const settingsSchema = new mongoose.Schema(
  {
    unitValueInr: { type: Number, required: true, default: 25000, min: 1 },
  },
  { timestamps: true }
);

settingsSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Settings', settingsSchema);
