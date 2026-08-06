import mongoose from 'mongoose';

// Singleton config (one document, like Settings) — TDS deducted when a wallet transfer
// request is approved (see wallets.service.js#requestWalletTransfer). 'percentage' applies
// value% of the requested amount; 'fixed' deducts a flat rupee amount (clamped to the
// requested amount so net can never go negative). Default 5% matches the rate the app
// already displayed (unconfigurable) on the old bank-withdrawal estimate screen.
const tdsConfigSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['fixed', 'percentage'], default: 'percentage' },
    value: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true }
);

tdsConfigSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('TdsConfig', tdsConfigSchema);
