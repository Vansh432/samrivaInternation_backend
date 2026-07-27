import { param, query } from 'express-validator';
import { MAX_TEAM_LEVEL } from '../../shared/constants/index.js';

export const levelParamValidation = [
  param('level').isInt({ min: 1, max: MAX_TEAM_LEVEL }).withMessage(`level must be between 1 and ${MAX_TEAM_LEVEL}`),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];
