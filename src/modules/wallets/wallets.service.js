import mongoose from 'mongoose';
import { logger } from '../../config/logger.js';
import {
  getOrCreateWallet,
  incrementWalletBalance,
  decrementWalletBalanceIfSufficient,
  getOrCreateCommissionSettlementConfig,
  updateCommissionSettlementConfig as updateCommissionSettlementConfigRepo,
  getOrCreateTdsConfig,
  updateTdsConfig as updateTdsConfigRepo,
} from './wallets.repository.js';
import {
  createWalletTransaction,
  listWalletTransactionsByUser,
  listPendingInWindow,
  sumPendingForUser,
  listPendingCreatedDates,
  markWalletTransactionSettled,
} from './walletTransactions.repository.js';
import {
  createWalletTransferRequest,
  findWalletTransferRequestById,
  listWalletTransferRequestsByUser,
  updateWalletTransferRequestStatus,
} from './walletTransferRequests.repository.js';
import { WALLET_TYPES, WALLET_TXN_TYPES } from '../../shared/constants/index.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';

const REQUESTABLE_WALLETS = [WALLET_TYPES.BONUS, WALLET_TYPES.REWARD, WALLET_TYPES.COMMISSION];

// Atomically increments a wallet balance and writes the matching ledger row — the two
// must never happen independently, so both run inside one Mongo transaction.
export const creditWallet = async ({ userId, walletType, amount, source, referenceModel, referenceId, description }) => {
  if (!amount || amount <= 0) return null;

  const session = await mongoose.startSession();
  let transaction;
  try {
    await session.withTransaction(async () => {
      const wallet = await incrementWalletBalance(userId, walletType, amount, session);
      transaction = await createWalletTransaction(
        {
          user: userId,
          walletType,
          type: WALLET_TXN_TYPES.CREDIT,
          amount,
          balanceAfter: wallet.balances[walletType],
          source,
          referenceModel,
          referenceId,
          description,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  await logEvent({
    type: 'wallet',
    action: 'wallet.credited',
    message: `Credited ${amount} to ${walletType} wallet (${source})`,
    user: userId,
    meta: { walletType, amount, source, referenceId: referenceId ? referenceId.toString() : undefined },
  });

  return transaction;
};

// Records a ledger row immediately (visible in the transaction list) but does NOT touch the
// wallet balance yet — used only for Commission-wallet credits (Rank Income, Direct
// Acquisition Bonus) that must wait for the next admin-configured closing date before they
// actually land in the balance. See settlePendingCommission for the other half of this.
export const creditWalletPending = async ({ userId, walletType, amount, source, referenceModel, referenceId, description }) => {
  if (!amount || amount <= 0) return null;

  const transaction = await createWalletTransaction({
    user: userId,
    walletType,
    type: WALLET_TXN_TYPES.CREDIT,
    amount,
    status: 'pending',
    source,
    referenceModel,
    referenceId,
    description,
  });

  await logEvent({
    type: 'wallet',
    action: 'wallet.creditPending',
    message: `${amount} pending in ${walletType} wallet (${source}) — settles on the next closing date`,
    user: userId,
    meta: { walletType, amount, source, referenceId: referenceId ? referenceId.toString() : undefined },
  });

  return transaction;
};

// Which admin-configured period a given date's day-of-month falls into, and the date that
// period's earnings settle on — always the following calendar month, mirroring
// settlePendingCommission's own prior-month lookback exactly (just run forward from an earn
// date here instead of backward from "today" there).
const settlementDateForEarnDate = (earnDate, config) => {
  const day = earnDate.getDate();
  const period = config.periods.find((p) => day >= p.startDay && (p.endDay == null || day <= p.endDay));
  if (!period) return null;
  return new Date(earnDate.getFullYear(), earnDate.getMonth() + 1, period.closingDay);
};

// Shown on the wallet screen so a user knows when their CURRENT pending commission balance
// actually lands. Must be computed from the real pending transactions, not from "today's"
// calendar position — a user's oldest pending money can belong to an earlier period than
// whatever period today happens to fall into, and it settles on ITS OWN period's date, not
// today's. Returns the earliest settlement date across all still-pending transactions.
const computeNextClosingDate = async (userId, config) => {
  const pending = await listPendingCreatedDates(userId, WALLET_TYPES.COMMISSION);
  if (!pending.length) return null;
  const dates = pending
    .map((t) => settlementDateForEarnDate(new Date(t.createdAt), config))
    .filter(Boolean);
  if (!dates.length) return null;
  return dates.reduce((earliest, d) => (d < earliest ? d : earliest));
};

export const getMyWalletBalances = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  const { main, bonus, reward, commission } = wallet.balances;
  const commissionPending = await sumPendingForUser(userId, WALLET_TYPES.COMMISSION);
  const config = await getOrCreateCommissionSettlementConfig();
  return {
    main, bonus, reward, commission,
    total: main + bonus + reward + commission,
    commissionPending,
    nextClosingDate: await computeNextClosingDate(userId, config),
  };
};

export const getCommissionSettlementConfig = () => getOrCreateCommissionSettlementConfig();

export const updateCommissionSettlementConfig = async (payload, actorId) => {
  const config = await updateCommissionSettlementConfigRepo(payload);
  await logEvent({
    type: 'admin', action: 'wallets.commissionSettlementConfig.updated',
    message: 'Commission settlement periods updated', actor: actorId, meta: { changes: payload },
  });
  return config;
};

// Daily job (see scheduler/commissionSettlement.cron.js) — checks whether today's
// day-of-month matches any configured closing day, and if so, releases every still-pending
// Commission-wallet credit whose earn-date fell in that period's window LAST calendar month
// (e.g. today=8th settles period "1st-7th" of the month that just ended). A no-op on every
// other day of the month.
export const settlePendingCommission = async ({ asOfDate } = {}) => {
  const now = asOfDate || new Date();
  const todayDate = now.getDate();
  const config = await getOrCreateCommissionSettlementConfig();
  const period = config.periods.find((p) => p.closingDay === todayDate);
  if (!period) {
    return { ranToday: false, period: null, settled: 0, totalAmount: 0 };
  }

  const priorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const windowStart = new Date(priorMonth.getFullYear(), priorMonth.getMonth(), period.startDay, 0, 0, 0, 0);
  const windowEnd = period.endDay
    ? new Date(priorMonth.getFullYear(), priorMonth.getMonth(), period.endDay, 23, 59, 59, 999)
    : new Date(priorMonth.getFullYear(), priorMonth.getMonth() + 1, 0, 23, 59, 59, 999); // last day of prior month

  const pendingTxns = await listPendingInWindow(WALLET_TYPES.COMMISSION, windowStart, windowEnd);

  let settled = 0;
  let totalAmount = 0;

  for (const txn of pendingTxns) {
    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const wallet = await incrementWalletBalance(txn.user, txn.walletType, txn.amount, session);
          await markWalletTransactionSettled(txn._id, wallet.balances[txn.walletType], session);
        });
      } finally {
        await session.endSession();
      }
      settled += 1;
      totalAmount += txn.amount;
    } catch (err) {
      logger.error('wallets.commissionSettlement.transactionFailed', { transactionId: txn._id.toString(), error: err.message });
    }
  }

  await logEvent({
    type: 'cron',
    action: 'wallets.commissionSettled',
    message: `Commission settlement (period ${period.order}, day ${period.startDay}-${period.endDay ?? 'end'}) — ${settled} transaction(s), ${totalAmount} total`,
    meta: { period: period.order, windowStart, windowEnd, settled, totalAmount },
  });

  return { ranToday: true, period: period.order, settled, totalAmount };
};

export const getMyWalletTransactions = async (userId, { walletType, type } = {}) => {
  const filter = {};
  if (walletType) filter.walletType = walletType;
  if (type) filter.type = type;
  return listWalletTransactionsByUser(userId, filter).limit(100);
};

export const getTdsConfig = () => getOrCreateTdsConfig();

export const updateTdsConfig = async (payload, actorId) => {
  const config = await updateTdsConfigRepo(payload);
  await logEvent({
    type: 'admin', action: 'wallets.tdsConfig.updated',
    message: 'TDS config updated', actor: actorId, meta: { changes: payload },
  });
  return config;
};

// mode='percentage' takes value% of amount; mode='fixed' deducts a flat rupee amount —
// clamped to `amount` either way so netAmount can never go negative.
const computeTds = (amount, tdsConfig) => {
  const raw = tdsConfig.mode === 'fixed' ? tdsConfig.value : amount * (tdsConfig.value / 100);
  const tdsAmount = Math.min(Math.max(raw, 0), amount);
  return { tdsAmount, netAmount: amount - tdsAmount };
};

// Bonus/Reward/Commission are earning wallets only — this is the only path out of them. As
// of this feature, moving funds into Main is no longer instant: the gross `amount` is
// debited (held) from fromWalletType right away so it can't be spent twice while pending,
// and only the TDS-adjusted `netAmount` actually lands in Main once an admin approves (see
// approveWalletTransferRequest/rejectWalletTransferRequest below). See wallet_withdrawal_rule.
export const requestWalletTransfer = async ({ userId, fromWalletType, amount }) => {
  if (!REQUESTABLE_WALLETS.includes(fromWalletType)) {
    throw new AppError('from must be one of bonus, reward, commission', 400);
  }
  if (!amount || amount <= 0) {
    throw new AppError('Enter a valid amount', 400);
  }

  const tdsConfig = await getOrCreateTdsConfig();
  const { tdsAmount, netAmount } = computeTds(amount, tdsConfig);

  const session = await mongoose.startSession();
  let request;
  try {
    await session.withTransaction(async () => {
      const debited = await decrementWalletBalanceIfSufficient(userId, fromWalletType, amount, session);
      if (!debited) throw new AppError('Insufficient balance', 400);

      request = await createWalletTransferRequest(
        {
          user: userId, fromWalletType, amount,
          tdsMode: tdsConfig.mode, tdsValue: tdsConfig.value, tdsAmount, netAmount,
          status: 'pending',
        },
        session
      );

      await createWalletTransaction(
        {
          user: userId,
          walletType: fromWalletType,
          type: WALLET_TXN_TYPES.DEBIT,
          amount,
          balanceAfter: debited.balances[fromWalletType],
          source: 'wallet_transfer_request_hold',
          referenceModel: 'WalletTransferRequest',
          referenceId: request._id,
          description: `Transfer request to Main Wallet — pending admin approval (₹${netAmount} net after TDS)`,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  await logEvent({
    type: 'wallet',
    action: 'wallet.transferRequest.created',
    message: `Transfer request of ${amount} from ${fromWalletType} submitted for approval (net ${netAmount} after TDS)`,
    user: userId,
    meta: { fromWalletType, amount, tdsAmount, netAmount, requestId: request._id.toString() },
  });

  return request;
};

export const getMyTransferRequests = (userId) => listWalletTransferRequestsByUser(userId);

export const approveWalletTransferRequest = async (requestId, adminId) => {
  const request = await findWalletTransferRequestById(requestId);
  if (!request) throw new AppError('Transfer request not found', 404);
  if (request.status !== 'pending') throw new AppError('This request has already been reviewed', 400);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const credited = await incrementWalletBalance(request.user, WALLET_TYPES.MAIN, request.netAmount, session);

      await createWalletTransaction(
        {
          user: request.user,
          walletType: WALLET_TYPES.MAIN,
          type: WALLET_TXN_TYPES.CREDIT,
          amount: request.netAmount,
          balanceAfter: credited.balances.main,
          source: 'wallet_transfer_request_approved',
          referenceModel: 'WalletTransferRequest',
          referenceId: request._id,
          description: `Transfer approved — ₹${request.amount} from ${request.fromWalletType} wallet, ₹${request.tdsAmount} TDS deducted`,
        },
        session
      );

      await updateWalletTransferRequestStatus(
        request._id,
        { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  await logEvent({
    type: 'admin',
    action: 'wallet.transferRequest.approved',
    message: `Transfer request approved — ₹${request.netAmount} credited to Main wallet`,
    actor: adminId,
    user: request.user,
    meta: { requestId: request._id.toString(), amount: request.amount, tdsAmount: request.tdsAmount, netAmount: request.netAmount },
  });

  return findWalletTransferRequestById(requestId);
};

// Refunds the full held amount back to the original sub-wallet — the TDS snapshot on the
// request itself is irrelevant here since nothing was ever actually deducted.
export const rejectWalletTransferRequest = async (requestId, adminId, reason) => {
  const request = await findWalletTransferRequestById(requestId);
  if (!request) throw new AppError('Transfer request not found', 404);
  if (request.status !== 'pending') throw new AppError('This request has already been reviewed', 400);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const refunded = await incrementWalletBalance(request.user, request.fromWalletType, request.amount, session);

      await createWalletTransaction(
        {
          user: request.user,
          walletType: request.fromWalletType,
          type: WALLET_TXN_TYPES.CREDIT,
          amount: request.amount,
          balanceAfter: refunded.balances[request.fromWalletType],
          source: 'wallet_transfer_request_rejected',
          referenceModel: 'WalletTransferRequest',
          referenceId: request._id,
          description: `Transfer request rejected — ₹${request.amount} refunded to ${request.fromWalletType} wallet`,
        },
        session
      );

      await updateWalletTransferRequestStatus(
        request._id,
        { status: 'rejected', reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: reason },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  await logEvent({
    type: 'admin',
    action: 'wallet.transferRequest.rejected',
    level: 'warn',
    message: `Transfer request rejected — ₹${request.amount} refunded to ${request.fromWalletType} wallet`,
    actor: adminId,
    user: request.user,
    meta: { requestId: request._id.toString(), amount: request.amount, reason },
  });

  return findWalletTransferRequestById(requestId);
};
