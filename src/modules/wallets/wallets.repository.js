import Wallet from './wallets.model.js';

export const getOrCreateWallet = async (userId, session) => {
  const existing = await Wallet.findOne({ user: userId }).session(session || null);
  if (existing) return existing;
  const [created] = await Wallet.create([{ user: userId }], { session });
  return created;
};

export const incrementWalletBalance = (userId, walletType, amount, session) =>
  Wallet.findOneAndUpdate(
    { user: userId },
    { $inc: { [`balances.${walletType}`]: amount } },
    { new: true, upsert: true, session }
  );
