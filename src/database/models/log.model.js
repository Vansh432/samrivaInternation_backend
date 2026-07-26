import mongoose from 'mongoose';

// Cross-cutting audit trail — not owned by a single module (hence living in database/models/
// rather than modules/*), so any part of the app can record a structured, queryable event
// alongside the existing winston file logger (see shared/utils/systemLog.js).
const logSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true }, // e.g. 'investment', 'wallet', 'cron', 'admin'
    action: { type: String, required: true }, // e.g. 'investment.approved', 'wallet.credited'
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    // Subject the event is about (e.g. the investor whose investment was approved).
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Who/what caused it — an admin, or absent for system/cron-originated events.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

logSchema.index({ type: 1, createdAt: -1 });

logSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Log', logSchema);
