import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as walletsService from './wallets.service.js';

export const balances = asyncHandler(async (req, res) => {
  const data = await walletsService.getMyWalletBalances(req.user._id);
  return sendSuccess(res, { message: 'Wallet balances', data });
});

export const transactions = asyncHandler(async (req, res) => {
  const { walletType, type } = req.query;
  const items = await walletsService.getMyWalletTransactions(req.user._id, { walletType, type });
  return sendSuccess(res, { message: 'Wallet transactions', data: { transactions: items } });
});

export const transferToMain = asyncHandler(async (req, res) => {
  const { from, amount } = req.body;
  const data = await walletsService.transferToMainWallet({ userId: req.user._id, fromWalletType: from, amount });
  return sendSuccess(res, { message: 'Transferred to Main Wallet', data });
});
