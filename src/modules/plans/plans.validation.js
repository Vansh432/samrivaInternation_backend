import { body, query } from 'express-validator';
import { PLAN_TYPES } from '../../shared/constants/index.js';

const tenureRules = [
  body('tenureMonths')
    .isArray({ min: 1 }).withMessage('Select at least one tenure (in months)'),
  body('tenureMonths.*')
    .isInt({ min: 1, max: 120 }).withMessage('Each tenure must be between 1 and 120 months'),
];

const rateRules = [
  body('compoundingRatePercent')
    .isFloat({ min: 0, max: 100 }).withMessage('Growth % must be between 0 and 100'),
  body('monthlyIncomeRatePercent')
    .isFloat({ min: 0, max: 100 }).withMessage('Income % must be between 0 and 100'),
];

export const createRateSlabValidation = [
  body('minUnits')
    .isInt({ min: 1 }).withMessage('Minimum units must be a positive integer'),
  body('maxUnits')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Maximum units must be a positive integer')
    .custom((value, { req }) => {
      if (value !== null && value !== undefined && Number(value) < Number(req.body.minUnits)) {
        throw new Error('Maximum units must be greater than or equal to minimum units');
      }
      return true;
    }),
  ...tenureRules,
  ...rateRules,
  body('isActive').optional().isBoolean(),
];

export const updateRateSlabValidation = [
  body('minUnits')
    .optional()
    .isInt({ min: 1 }).withMessage('Minimum units must be a positive integer'),
  body('maxUnits')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Maximum units must be a positive integer'),
  body('tenureMonths')
    .optional()
    .isArray({ min: 1 }).withMessage('Select at least one tenure (in months)'),
  body('tenureMonths.*')
    .optional()
    .isInt({ min: 1, max: 120 }).withMessage('Each tenure must be between 1 and 120 months'),
  body('compoundingRatePercent')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Growth % must be between 0 and 100'),
  body('monthlyIncomeRatePercent')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Income % must be between 0 and 100'),
  body('isActive').optional().isBoolean(),
];

export const getRateValidation = [
  query('units')
    .isInt({ min: 1 }).withMessage('units must be a positive integer'),
  query('tenure')
    .isInt({ min: 1, max: 120 }).withMessage('tenure must be a valid number of months'),
  query('planType')
    .isIn(Object.values(PLAN_TYPES)).withMessage('planType must be compounding or monthly_income'),
];
