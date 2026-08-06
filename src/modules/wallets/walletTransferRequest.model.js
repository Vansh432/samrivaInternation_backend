import mongoose from 'mongoose';
import { WALLET_TYPES } from '../../shared/constants/index.js';

const REQUESTABLE_WALLETS = [WALLET_TYPES.BONUS, WALLET_TYPES.REWARD, WALLET_TYPES.COMMISSION];

// A user-submitted request to move money from a sub-wallet into Main — no longer instant
// (see wallets.service.js#requestWalletTransfer): the gross `amount` is debited from
// fromWalletType immediately (held, so it can't be double-spent while pending), and only
// `netAmount` (amount minus TDS) actually lands in Main once an admin approves. TDS fields
// are snapshotted at request time from TdsConfig — locked in regardless of later config
// changes, same "locked at request time" principle used for investment rate/unit-value.
const walletTransferRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromWalletType: { type: String, enum: REQUESTABLE_WALLETS, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    tdsMode: { type: String, enum: ['fixed', 'percentage'], required: true },
    tdsValue: { type: Number, required: true },
    tdsAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    // Only set when status === 'rejected'.
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

walletTransferRequestSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('WalletTransferRequest', walletTransferRequestSchema);
