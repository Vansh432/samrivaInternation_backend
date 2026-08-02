import mongoose from 'mongoose';
import { getOrCreateWallet, incrementWalletBalance, decrementWalletBalanceIfSufficient } from './wallets.repository.js';
import { createWalletTransaction, listWalletTransactionsByUser } from './walletTransactions.repository.js';
import { WALLET_TYPES, WALLET_TXN_TYPES } from '../../shared/constants/index.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';

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

export const getMyWalletBalances = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  const { main, bonus, reward, commission } = wallet.balances;
  return { main, bonus, reward, commission, total: main + bonus + reward + commission };
};

export const getMyWalletTransactions = async (userId, { walletType, type } = {}) => {
  const filter = {};
  if (walletType) filter.walletType = walletType;
  if (type) filter.type = type;
  return listWalletTransactionsByUser(userId, filter).limit(100);
};

// Bonus/Reward/Commission are earning wallets only — this is the only path out of them,
// moving funds into Main where they become withdrawable (see wallet_withdrawal_rule).
export const transferToMainWallet = async ({ userId, fromWalletType, amount }) => {
  if (fromWalletType === WALLET_TYPES.MAIN) {
    throw new AppError('Cannot transfer from Main wallet to itself', 400);
  }
  if (!amount || amount <= 0) {
    throw new AppError('Enter a valid amount', 400);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const debited = await decrementWalletBalanceIfSufficient(userId, fromWalletType, amount, session);
      if (!debited) throw new AppError('Insufficient balance', 400);

      await createWalletTransaction(
        {
          user: userId,
          walletType: fromWalletType,
          type: WALLET_TXN_TYPES.DEBIT,
          amount,
          balanceAfter: debited.balances[fromWalletType],
          source: 'wallet_transfer_out',
          description: 'Transferred to Main Wallet',
        },
        session
      );

      const credited = await incrementWalletBalance(userId, WALLET_TYPES.MAIN, amount, session);

      await createWalletTransaction(
        {
          user: userId,
          walletType: WALLET_TYPES.MAIN,
          type: WALLET_TXN_TYPES.CREDIT,
          amount,
          balanceAfter: credited.balances.main,
          source: 'wallet_transfer_in',
          description: `Transferred from ${fromWalletType.charAt(0).toUpperCase()}${fromWalletType.slice(1)} Wallet`,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  await logEvent({
    type: 'wallet',
    action: 'wallet.transferredToMain',
    message: `Transferred ${amount} from ${fromWalletType} to Main wallet`,
    user: userId,
    meta: { fromWalletType, amount },
  });

  return getMyWalletBalances(userId);
};
