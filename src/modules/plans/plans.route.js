import { Router } from 'express';
import { param } from 'express-validator';
import * as plansController from './plans.controller.js';
import { createRateSlabValidation, updateRateSlabValidation, getRateValidation } from './plans.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../shared/constants/index.js';

const router = Router();
const idValidation = [param('id').isMongoId().withMessage('Invalid rate slab id')];
const adminOnly = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

router.get('/rate', protect, getRateValidation, validate, plansController.getRate);
router.get('/', protect, plansController.list);
router.post('/', protect, adminOnly, createRateSlabValidation, validate, plansController.create);
router.patch('/:id', protect, adminOnly, idValidation, updateRateSlabValidation, validate, plansController.update);
router.delete('/:id', protect, adminOnly, idValidation, validate, plansController.remove);

export default router;
