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

export const createTransferRequest = asyncHandler(async (req, res) => {
  const { from, amount } = req.body;
  const data = await walletsService.requestWalletTransfer({ userId: req.user._id, fromWalletType: from, amount });
  return sendSuccess(res, { statusCode: 201, message: 'Transfer request submitted for admin approval', data });
});

export const myTransferRequests = asyncHandler(async (req, res) => {
  const items = await walletsService.getMyTransferRequests(req.user._id);
  return sendSuccess(res, { message: 'My transfer requests', data: { items } });
});

export const getTdsConfig = asyncHandler(async (req, res) => {
  const config = await walletsService.getTdsConfig();
  return sendSuccess(res, { message: 'TDS config', data: { config } });
});

export const updateTdsConfig = asyncHandler(async (req, res) => {
  const config = await walletsService.updateTdsConfig(req.body, req.user._id);
  return sendSuccess(res, { message: 'TDS config updated', data: { config } });
});

export const getCommissionSettlementConfig = asyncHandler(async (req, res) => {
  const config = await walletsService.getCommissionSettlementConfig();
  return sendSuccess(res, { message: 'Commission settlement config', data: { config } });
});

export const updateCommissionSettlementConfig = asyncHandler(async (req, res) => {
  const config = await walletsService.updateCommissionSettlementConfig(req.body, req.user._id);
  return sendSuccess(res, { message: 'Commission settlement config updated', data: { config } });
});
