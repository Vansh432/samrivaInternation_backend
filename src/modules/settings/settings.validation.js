import { body } from 'express-validator';

export const updateSettingsValidation = [
  body('unitValueInr')
    .isFloat({ min: 1, max: 100000000 }).withMessage('Unit value must be a positive amount in rupees'),
];
