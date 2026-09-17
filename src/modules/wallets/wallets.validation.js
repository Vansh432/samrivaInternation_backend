import { body, query } from 'express-validator';
import { WALLET_TYPES, WALLET_TXN_TYPES } from '../../shared/constants/index.js';

export const listMyTransactionsValidation = [
  query('walletType').optional().isIn(Object.values(WALLET_TYPES)).withMessage('Invalid wallet type'),
  query('type').optional().isIn(Object.values(WALLET_TXN_TYPES)).withMessage('Invalid transaction type'),
];

const TRANSFERABLE_WALLETS = [WALLET_TYPES.BONUS, WALLET_TYPES.REWARD, WALLET_TYPES.COMMISSION];

export const createTransferRequestValidation = [
  body('from').isIn(TRANSFERABLE_WALLETS).withMessage('from must be one of bonus, reward, commission'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
];

export const updateTdsConfigValidation = [
  body('mode').optional().isIn(['fixed', 'percentage']).withMessage('mode must be fixed or percentage'),
  body('value').optional().isFloat({ min: 0 }).withMessage('value must be 0 or greater'),
  body('panRate').isFloat({ min: 0, max: 100 }).withMessage('panRate must be between 0 and 100'),
  body('noPanRate').isFloat({ min: 0, max: 100 }).withMessage('noPanRate must be between 0 and 100'),
];

export const updateAdminChargeConfigValidation = [
  body('percentage').isFloat({ min: 0, max: 100 }).withMessage('percentage must be between 0 and 100'),
];

export const updateCommissionSettlementConfigValidation = [
  body('periods').isArray({ min: 4, max: 4 }).withMessage('periods must be an array of exactly 4 entries'),
  body('periods.*.order').isInt({ min: 1, max: 4 }).withMessage('order must be between 1 and 4'),
  body('periods.*.startDay').isInt({ min: 1, max: 31 }).withMessage('startDay must be between 1 and 31'),
  body('periods.*.endDay').optional({ nullable: true }).isInt({ min: 1, max: 31 }).withMessage('endDay must be between 1 and 31'),
  body('periods.*.closingDay').isInt({ min: 1, max: 31 }).withMessage('closingDay must be between 1 and 31'),
];
