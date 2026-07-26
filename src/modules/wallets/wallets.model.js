import mongoose from 'mongoose';

// One wallet document per user. Reward/Bonus/Commission are earning wallets credited by
// their respective modules (rewards, bonuses, referral commissions); Main is the only
// wallet withdrawals are ever paid out from — earnings move into it via an explicit
// sub-wallet -> main transfer, never withdrawn directly from a sub-wallet.
const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balances: {
      main: { type: Number, default: 0, min: 0 },
      reward: { type: Number, default: 0, min: 0 },
      bonus: { type: Number, default: 0, min: 0 },
      commission: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

walletSchema.virtual('totalBalance').get(function () {
  return this.balances.main + this.balances.reward + this.balances.bonus + this.balances.commission;
});

walletSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Wallet', walletSchema);
