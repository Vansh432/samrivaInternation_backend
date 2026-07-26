import mongoose from 'mongoose';
import { incrementWalletBalance } from './wallets.repository.js';
import { createWalletTransaction } from './walletTransactions.repository.js';
import { WALLET_TXN_TYPES } from '../../shared/constants/index.js';
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
