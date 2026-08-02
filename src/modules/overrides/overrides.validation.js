import { body } from 'express-validator';

export const createOverrideSlabValidation = [
  body('generation').isInt({ min: 1, max: 3 }).withMessage('Generation must be 1, 2, or 3'),
  body('percent').isFloat({ min: 0, max: 100 }).withMessage('Percent must be between 0 and 100'),
  body('isActive').optional().isBoolean(),
];

export const updateOverrideSlabValidation = [
  body('generation').optional().isInt({ min: 1, max: 3 }).withMessage('Generation must be 1, 2, or 3'),
  body('percent').optional().isFloat({ min: 0, max: 100 }).withMessage('Percent must be between 0 and 100'),
  body('isActive').optional().isBoolean(),
];
