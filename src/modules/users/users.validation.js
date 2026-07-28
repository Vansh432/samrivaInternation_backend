import { body } from 'express-validator';

export const updateProfileValidation = [
  body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('fatherOrHusbandName').optional().trim().isLength({ min: 2 }).withMessage("Father's/Husband's name must be at least 2 characters"),
  body('email').optional().trim().isEmail().withMessage('Enter a valid email'),
  body('dob').optional().isISO8601().toDate().withMessage('Enter a valid date of birth'),
  body('address.line1').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.pincode').optional().trim(),
];

export const submitKycValidation = [
  body('pan').trim().isLength({ min: 10 }).withMessage('PAN number is required'),
  body('aadhaar').trim().isLength({ min: 12, max: 12 }).isNumeric().withMessage('Aadhaar must be exactly 12 digits'),
  body('bank.accountNumber').trim().isLength({ min: 6 }).withMessage('Bank account number is required'),
  body('bank.ifsc').trim().isLength({ min: 8 }).withMessage('IFSC code is required'),
  body('bank.holderName').trim().isLength({ min: 2 }).withMessage('Account holder name is required'),
  body('nominee.name').trim().isLength({ min: 2 }).withMessage('Nominee name is required'),
  body('nominee.relation').trim().isLength({ min: 2 }).withMessage('Nominee relation is required'),
  body('nominee.sharePercent').optional().isInt({ min: 1, max: 100 }).withMessage('Nominee share must be between 1 and 100'),
  body('addressProofUrl').notEmpty().withMessage('Address proof is required'),
  body('selfieUrl').notEmpty().withMessage('Selfie is required'),
  body('termsAccepted')
    .isBoolean().withMessage('termsAccepted must be a boolean')
    .bail()
    .toBoolean()
    .custom((value) => value === true).withMessage('You must accept the terms and conditions'),
];
