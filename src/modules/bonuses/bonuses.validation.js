import { body } from 'express-validator';

export const createFastStartSlabValidation = [
  body('unitsThreshold').isInt({ min: 1 }).withMessage('Units threshold must be a positive integer'),
  body('bonusAmount').isFloat({ min: 0 }).withMessage('Bonus amount must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];

export const updateFastStartSlabValidation = [
  body('unitsThreshold').optional().isInt({ min: 1 }).withMessage('Units threshold must be a positive integer'),
  body('bonusAmount').optional().isFloat({ min: 0 }).withMessage('Bonus amount must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];

export const createRetentionSlabValidation = [
  body('unitsThreshold').isInt({ min: 1 }).withMessage('Units threshold must be a positive integer'),
  body('bonusAmount').isFloat({ min: 0 }).withMessage('Bonus amount must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];

export const updateRetentionSlabValidation = [
  body('unitsThreshold').optional().isInt({ min: 1 }).withMessage('Units threshold must be a positive integer'),
  body('bonusAmount').optional().isFloat({ min: 0 }).withMessage('Bonus amount must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];
