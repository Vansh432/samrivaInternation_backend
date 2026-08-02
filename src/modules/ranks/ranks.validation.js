import { body } from 'express-validator';
import { RANKS } from '../../shared/constants/index.js';

const NON_INVESTOR_RANKS = Object.values(RANKS).filter((r) => r !== RANKS.INVESTOR);

export const createRankSlabValidation = [
  body('rank').isIn(NON_INVESTOR_RANKS).withMessage('rank must be a non-investor rank'),
  body('selfUnitsMin').isInt({ min: 0 }).withMessage('selfUnitsMin must be 0 or greater'),
  body('directTeamSizeMin').isInt({ min: 0 }).withMessage('directTeamSizeMin must be 0 or greater'),
  body('requiredDirectRank').isIn(Object.values(RANKS)).withMessage('Invalid requiredDirectRank'),
  body('teamBusinessUnitMin').optional().isInt({ min: 0 }).withMessage('teamBusinessUnitMin must be 0 or greater'),
  body('incomePercent').isFloat({ min: 0, max: 100 }).withMessage('incomePercent must be between 0 and 100'),
  body('isActive').optional().isBoolean(),
];

export const updateRankSlabValidation = [
  body('rank').optional().isIn(NON_INVESTOR_RANKS).withMessage('rank must be a non-investor rank'),
  body('selfUnitsMin').optional().isInt({ min: 0 }).withMessage('selfUnitsMin must be 0 or greater'),
  body('directTeamSizeMin').optional().isInt({ min: 0 }).withMessage('directTeamSizeMin must be 0 or greater'),
  body('requiredDirectRank').optional().isIn(Object.values(RANKS)).withMessage('Invalid requiredDirectRank'),
  body('teamBusinessUnitMin').optional().isInt({ min: 0 }).withMessage('teamBusinessUnitMin must be 0 or greater'),
  body('incomePercent').optional().isFloat({ min: 0, max: 100 }).withMessage('incomePercent must be between 0 and 100'),
  body('isActive').optional().isBoolean(),
];

const BENEFIT_AMOUNT_FIELDS = [
  'mobileBonus',
  'groomingBonus',
  'conveyanceBonus',
  'lifeStyleBonus',
  'businessTourBonus',
  'familyTripBonus',
];

export const createRankBenefitSlabValidation = [
  body('rank').isIn(NON_INVESTOR_RANKS).withMessage('rank must be a non-investor rank'),
  ...BENEFIT_AMOUNT_FIELDS.map((f) => body(f).optional().isInt({ min: 0 }).withMessage(`${f} must be 0 or greater`)),
  body('qualifyingDirectUnitsPerMonth').isInt({ min: 0 }).withMessage('qualifyingDirectUnitsPerMonth must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];

export const updateRankBenefitSlabValidation = [
  body('rank').optional().isIn(NON_INVESTOR_RANKS).withMessage('rank must be a non-investor rank'),
  ...BENEFIT_AMOUNT_FIELDS.map((f) => body(f).optional().isInt({ min: 0 }).withMessage(`${f} must be 0 or greater`)),
  body('qualifyingDirectUnitsPerMonth').optional().isInt({ min: 0 }).withMessage('qualifyingDirectUnitsPerMonth must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];

export const createRankAchievementSlabValidation = [
  body('rank').isIn(NON_INVESTOR_RANKS).withMessage('rank must be a non-investor rank'),
  body('amount').isFloat({ min: 0 }).withMessage('amount must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];

export const updateRankAchievementSlabValidation = [
  body('rank').optional().isIn(NON_INVESTOR_RANKS).withMessage('rank must be a non-investor rank'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be 0 or greater'),
  body('isActive').optional().isBoolean(),
];
