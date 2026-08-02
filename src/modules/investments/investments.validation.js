import { body, param, query } from 'express-validator';
import { PLAN_TYPES, PAYMENT_MODES } from '../../shared/constants/index.js';

export const createInvestmentValidation = [
  body('planType')
    .isIn(Object.values(PLAN_TYPES)).withMessage('planType must be compounding or monthly_income'),
  body('units')
    .isInt({ min: 1 }).withMessage('units must be a positive integer'),
  body('tenureMonths')
    .isInt({ min: 1, max: 120 }).withMessage('tenureMonths must be a valid number of months'),
  body('paymentMode')
    .isIn(Object.values(PAYMENT_MODES)).withMessage('Invalid payment mode'),
  body('amountPaid')
    .isFloat({ min: 1 }).withMessage('Amount paid is required'),
  body('transactionId')
    .trim().isLength({ min: 4 }).withMessage('Transaction ID is required'),
  // Payment proof photo is required for every mode except cash.
  body('paymentProofUrl')
    .if((value, { req }) => req.body.paymentMode !== PAYMENT_MODES.CASH)
    .notEmpty().withMessage('Payment proof photo is required for this payment mode'),
];

export const investmentIdValidation = [
  param('id').isMongoId().withMessage('Invalid investment id'),
];

export const renewInvestmentValidation = [
  body('fromInvestmentId').isMongoId().withMessage('Invalid investment id'),
  body('planType')
    .isIn(Object.values(PLAN_TYPES)).withMessage('planType must be compounding or monthly_income'),
  body('units')
    .isInt({ min: 1 }).withMessage('units must be a positive integer'),
  body('tenureMonths')
    .isInt({ min: 1, max: 120 }).withMessage('tenureMonths must be a valid number of months'),
];

export const investmentQuoteValidation = [
  query('planType')
    .isIn(Object.values(PLAN_TYPES)).withMessage('planType must be compounding or monthly_income'),
  query('units')
    .isInt({ min: 1 }).withMessage('units must be a positive integer'),
  query('tenureMonths')
    .isInt({ min: 1, max: 120 }).withMessage('tenureMonths must be a valid number of months'),
];
