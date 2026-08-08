import WalletTransaction from './walletTransactions.model.js';
import { WALLET_TYPES, WALLET_TXN_TYPES } from '../../shared/constants/index.js';

export const createWalletTransaction = (payload, session) =>
  WalletTransaction.create([payload], { session }).then(([doc]) => doc);

export const listWalletTransactionsByUser = (userId, filter = {}) =>
  WalletTransaction.find({ user: userId, ...filter }).sort({ createdAt: -1 });

// Cross-user ledger listing for admin views (e.g. the Fast Start Bonus awards table) —
// mirrors investments.repository.js#listInvestmentsAdmin's filter/paginate/populate shape.
export const listWalletTransactionsAdmin = ({ filter = {}, skip = 0, limit = 20 }) =>
  WalletTransaction.find(filter).populate('user', 'mobile fullName').sort({ createdAt: -1 }).skip(skip).limit(limit);

export const countWalletTransactions = (filter = {}) => WalletTransaction.countDocuments(filter);

// Sum of a user's Commission wallet CREDITS within a date range — the payout base for the
// monthly Leadership Override settlement (see overrides.service.js#settleLeadershipOverrides).
export const sumCommissionCreditsForUserInWindow = async (userId, start, end) => {
  const [result] = await WalletTransaction.aggregate([
    {
      $match: {
        user: userId,
        walletType: WALLET_TYPES.COMMISSION,
        type: WALLET_TXN_TYPES.CREDIT,
        createdAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result?.total || 0;
};

// --- Pending -> settled commission lifecycle (see wallets.service.js#settlePendingCommission) ---

export const listPendingInWindow = (walletType, start, end) =>
  WalletTransaction.find({ walletType, status: 'pending', createdAt: { $gte: start, $lte: end } });

export const sumPendingForUser = async (userId, walletType) => {
  const [result] = await WalletTransaction.aggregate([
    { $match: { user: userId, walletType, status: 'pending', type: WALLET_TXN_TYPES.CREDIT } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result?.total || 0;
};

// Earn dates only, for the wallet screen's "settles on" indicator — each pending
// transaction's own createdAt determines which settlement period it belongs to (see
// wallets.service.js#computeNextClosingDate), not "today's" date.
export const listPendingCreatedDates = (userId, walletType) =>
  WalletTransaction.find(
    { user: userId, walletType, status: 'pending', type: WALLET_TXN_TYPES.CREDIT },
    'createdAt'
  ).lean();

export const markWalletTransactionSettled = (id, balanceAfter, session) =>
  WalletTransaction.findByIdAndUpdate(
    id,
    { $set: { status: 'settled', settledAt: new Date(), balanceAfter } },
    { new: true, session }
  );
