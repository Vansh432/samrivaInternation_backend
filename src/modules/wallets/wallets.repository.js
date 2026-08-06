import Wallet from './wallets.model.js';
import CommissionSettlementConfig from './commissionSettlementConfig.model.js';
import TdsConfig from './tdsConfig.model.js';

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

// --- Commission settlement config (see wallets.service.js#settlePendingCommission) ---

export const getOrCreateCommissionSettlementConfig = () =>
  CommissionSettlementConfig.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

export const updateCommissionSettlementConfig = async (update) => {
  await getOrCreateCommissionSettlementConfig();
  return CommissionSettlementConfig.findOneAndUpdate({}, update, { new: true, runValidators: true });
};

// --- TDS config (see wallets.service.js#requestWalletTransfer) ---

export const getOrCreateTdsConfig = () =>
  TdsConfig.findOneAndUpdate({}, { $setOnInsert: {} }, { upsert: true, new: true, setDefaultsOnInsert: true });

export const updateTdsConfig = async (update) => {
  await getOrCreateTdsConfig();
  return TdsConfig.findOneAndUpdate({}, update, { new: true, runValidators: true });
};
