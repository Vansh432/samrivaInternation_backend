import WalletTransaction from './walletTransactions.model.js';

export const createWalletTransaction = (payload, session) =>
  WalletTransaction.create([payload], { session }).then(([doc]) => doc);

export const listWalletTransactionsByUser = (userId, filter = {}) =>
  WalletTransaction.find({ user: userId, ...filter }).sort({ createdAt: -1 });

// Cross-user ledger listing for admin views (e.g. the Fast Start Bonus awards table) —
// mirrors investments.repository.js#listInvestmentsAdmin's filter/paginate/populate shape.
export const listWalletTransactionsAdmin = ({ filter = {}, skip = 0, limit = 20 }) =>
  WalletTransaction.find(filter).populate('user', 'mobile fullName').sort({ createdAt: -1 }).skip(skip).limit(limit);

export const countWalletTransactions = (filter = {}) => WalletTransaction.countDocuments(filter);
