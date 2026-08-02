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

// Atomically debits only if the balance still covers it — returns null if not, so the
// caller never has to trust a separate check-then-debit (same conditional-update pattern
// as claimIncomeMonths/claimMaturity in investments.repository.js).
export const decrementWalletBalanceIfSufficient = (userId, walletType, amount, session) =>
  Wallet.findOneAndUpdate(
    { user: userId, [`balances.${walletType}`]: { $gte: amount } },
    { $inc: { [`balances.${walletType}`]: -amount } },
    { new: true, session }
  );
