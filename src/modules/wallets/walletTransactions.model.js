import mongoose from 'mongoose';
import { WALLET_TYPES, WALLET_TXN_TYPES } from '../../shared/constants/index.js';

// Immutable ledger row for every wallet balance change — the Wallet document only holds
// the current balance, this is the audit trail of how it got there.
const walletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    walletType: { type: String, enum: Object.values(WALLET_TYPES), required: true },
    type: { type: String, enum: Object.values(WALLET_TXN_TYPES), required: true },
    amount: { type: Number, required: true, min: 0 },
    // Snapshot of the wallet's balance for `walletType` immediately after this entry —
    // lets the ledger be read as a running history without re-deriving from scratch.
    balanceAfter: { type: Number, required: true },
    // e.g. 'investment_monthly_income', 'investment_maturity' — free-form so any future
    // module (rewards, bonuses, commissions, withdrawals) can introduce its own source tag.
    source: { type: String, required: true },
    referenceModel: { type: String },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });

walletTransactionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('WalletTransaction', walletTransactionSchema);
