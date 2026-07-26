import { body, param } from 'express-validator';
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
];

export const investmentIdValidation = [
  param('id').isMongoId().withMessage('Invalid investment id'),
];
