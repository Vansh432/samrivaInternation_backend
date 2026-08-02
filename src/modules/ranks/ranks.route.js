import { Router } from 'express';
import { param } from 'express-validator';
import * as ranksController from './ranks.controller.js';
import {
  createRankSlabValidation,
  updateRankSlabValidation,
  createRankBenefitSlabValidation,
  updateRankBenefitSlabValidation,
  createRankAchievementSlabValidation,
  updateRankAchievementSlabValidation,
} from './ranks.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../shared/constants/index.js';

const router = Router();
const idValidation = [param('id').isMongoId().withMessage('Invalid rank slab id')];
const adminOnly = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

router.get('/me', protect, ranksController.myRankStatus);
router.get('/benefits/me', protect, ranksController.myRankBenefits);
router.get('/benefit-slabs', protect, ranksController.listBenefitSlabs);
router.post('/benefit-slabs', protect, adminOnly, createRankBenefitSlabValidation, validate, ranksController.createBenefitSlab);
router.patch(
  '/benefit-slabs/:id',
  protect,
  adminOnly,
  idValidation,
  updateRankBenefitSlabValidation,
  validate,
  ranksController.updateBenefitSlab
);
router.delete('/benefit-slabs/:id', protect, adminOnly, idValidation, validate, ranksController.removeBenefitSlab);
router.post('/benefits/evaluate', protect, adminOnly, ranksController.evaluateBenefits);

router.get('/achievement-slabs', protect, ranksController.listAchievementSlabs);
router.post(
  '/achievement-slabs',
  protect,
  adminOnly,
  createRankAchievementSlabValidation,
  validate,
  ranksController.createAchievementSlab
);
router.patch(
  '/achievement-slabs/:id',
  protect,
  adminOnly,
  idValidation,
  updateRankAchievementSlabValidation,
  validate,
  ranksController.updateAchievementSlab
);
router.delete('/achievement-slabs/:id', protect, adminOnly, idValidation, validate, ranksController.removeAchievementSlab);

router.get('/', protect, ranksController.listSlabs);
router.post('/', protect, adminOnly, createRankSlabValidation, validate, ranksController.createSlab);
router.patch('/:id', protect, adminOnly, idValidation, updateRankSlabValidation, validate, ranksController.updateSlab);
router.delete('/:id', protect, adminOnly, idValidation, validate, ranksController.removeSlab);
router.post('/recalculate', protect, adminOnly, ranksController.recalculate);

export default router;
