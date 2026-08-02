import { body, query } from 'express-validator';
import { WALLET_TYPES, WALLET_TXN_TYPES } from '../../shared/constants/index.js';

export const listMyTransactionsValidation = [
  query('walletType').optional().isIn(Object.values(WALLET_TYPES)).withMessage('Invalid wallet type'),
  query('type').optional().isIn(Object.values(WALLET_TXN_TYPES)).withMessage('Invalid transaction type'),
];

const TRANSFERABLE_WALLETS = [WALLET_TYPES.BONUS, WALLET_TYPES.REWARD, WALLET_TYPES.COMMISSION];

export const transferToMainValidation = [
  body('from').isIn(TRANSFERABLE_WALLETS).withMessage('from must be one of bonus, reward, commission'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
];
