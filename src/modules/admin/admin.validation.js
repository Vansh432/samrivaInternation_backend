import { body, param, query } from 'express-validator';
import { ROLES, USER_STATUS, INVESTMENT_STATUS, PLAN_TYPES, MAX_TEAM_LEVEL } from '../../shared/constants/index.js';

export const userIdParamValidation = [param('id').isMongoId().withMessage('Invalid user id')];

export const listUsersValidation = [
  query('role').optional().isIn(Object.values(ROLES)).withMessage('Invalid role'),
  query('status').optional().isIn(Object.values(USER_STATUS)).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

export const updateRoleValidation = [
  ...userIdParamValidation,
  body('role').isIn(Object.values(ROLES)).withMessage('Invalid role'),
];

export const updateStatusValidation = [
  ...userIdParamValidation,
  body('status').isIn(Object.values(USER_STATUS)).withMessage('Invalid status'),
];

export const kycActionValidation = userIdParamValidation;

export const rejectKycValidation = [
  ...userIdParamValidation,
  body('reason').trim().notEmpty().withMessage('Rejection reason is required'),
];

export const holdKycValidation = [
  ...userIdParamValidation,
  body('reason').trim().notEmpty().withMessage('A reason is required to put KYC on hold'),
];

export const investmentActionValidation = [param('id').isMongoId().withMessage('Invalid investment id')];

export const rejectInvestmentValidation = [
  ...investmentActionValidation,
  body('reason').trim().notEmpty().withMessage('Rejection reason is required'),
];

export const listInvestmentsAdminValidation = [
  query('status').optional().isIn(Object.values(INVESTMENT_STATUS)).withMessage('Invalid status'),
  query('planType').optional().isIn(Object.values(PLAN_TYPES)).withMessage('Invalid plan type'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

export const teamUserIdValidation = [param('userId').isMongoId().withMessage('Invalid user id')];

export const teamLevelValidation = [
  ...teamUserIdValidation,
  param('level').isInt({ min: 1, max: MAX_TEAM_LEVEL }).withMessage(`level must be between 1 and ${MAX_TEAM_LEVEL}`),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];
