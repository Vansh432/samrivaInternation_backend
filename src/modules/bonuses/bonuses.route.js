import { Router } from 'express';
import { param } from 'express-validator';
import * as bonusesController from './bonuses.controller.js';
import {
  createFastStartSlabValidation,
  updateFastStartSlabValidation,
  createRetentionSlabValidation,
  updateRetentionSlabValidation,
  updateDirectAcquisitionConfigValidation,
} from './bonuses.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../shared/constants/index.js';

const router = Router();
const idValidation = [param('id').isMongoId().withMessage('Invalid slab id')];
const adminOnly = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

router.get('/fast-start', protect, bonusesController.myFastStart);

router.get('/fast-start/slabs', protect, bonusesController.listSlabs);
router.post('/fast-start/slabs', protect, adminOnly, createFastStartSlabValidation, validate, bonusesController.createSlab);
router.patch('/fast-start/slabs/:id', protect, adminOnly, idValidation, updateFastStartSlabValidation, validate, bonusesController.updateSlab);
router.delete('/fast-start/slabs/:id', protect, adminOnly, idValidation, validate, bonusesController.removeSlab);

router.get('/fast-start/awards', protect, adminOnly, bonusesController.listAwards);

router.get('/retention', protect, bonusesController.myRetention);

router.get('/retention/slabs', protect, bonusesController.listRetentionSlabs);
router.post('/retention/slabs', protect, adminOnly, createRetentionSlabValidation, validate, bonusesController.createRetentionSlab);
router.patch('/retention/slabs/:id', protect, adminOnly, idValidation, updateRetentionSlabValidation, validate, bonusesController.updateRetentionSlab);
router.delete('/retention/slabs/:id', protect, adminOnly, idValidation, validate, bonusesController.removeRetentionSlab);

router.get('/retention/awards', protect, adminOnly, bonusesController.listRetentionAwards);

router.get('/direct-acquisition', protect, bonusesController.getDirectAcquisitionConfig);
router.patch(
  '/direct-acquisition',
  protect,
  adminOnly,
  updateDirectAcquisitionConfigValidation,
  validate,
  bonusesController.updateDirectAcquisitionConfig
);

export default router;
