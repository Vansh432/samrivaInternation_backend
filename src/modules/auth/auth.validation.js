import { body } from 'express-validator';
import { ROLES } from '../../shared/constants/index.js';

export const registerValidation = [
  body('mobile')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^\+\d{10,14}$/).withMessage('Enter a valid mobile with country code (e.g. +919999900002)'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn([ROLES.INVESTOR, ROLES.WEALTH_PARTNER]).withMessage('Role must be investor or wealth_partner'),
  body('sponsorId')
    .trim()
    .notEmpty().withMessage('Sponsor ID is required'),
];

export const loginValidation = [
  body('mobile')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .matches(/^\+\d{10,14}$/).withMessage('Enter a valid mobile with country code (e.g. +919999900002)'),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

export const refreshValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required'),
];
