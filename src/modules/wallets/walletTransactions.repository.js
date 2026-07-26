import WalletTransaction from './walletTransactions.model.js';

export const createWalletTransaction = (payload, session) =>
  WalletTransaction.create([payload], { session }).then(([doc]) => doc);

export const listWalletTransactionsByUser = (userId, filter = {}) =>
  WalletTransaction.find({ user: userId, ...filter }).sort({ createdAt: -1 });
