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
    // lets the ledger be read as a running history without re-deriving from scratch. Not
    // set yet for a still-`pending` row (see `status` below) — populated once settled.
    balanceAfter: { type: Number },
    // e.g. 'investment_monthly_income', 'investment_maturity' — free-form so any future
    // module (rewards, bonuses, commissions, withdrawals) can introduce its own source tag.
    source: { type: String, required: true },
    referenceModel: { type: String },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String },
    // 'pending' rows (currently only Rank Income / Direct Acquisition Bonus commission
    // credits) are visible in the ledger but have NOT touched the wallet balance yet — see
    // wallets.service.js#creditWalletPending / #settlePendingCommission. Every other credit
    // in the app is created directly as 'settled' (the default) and never changes state.
    status: { type: String, enum: ['pending', 'settled'], default: 'settled' },
    settledAt: { type: Date, default: null },
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
