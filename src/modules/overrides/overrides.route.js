import { Router } from 'express';
import { param } from 'express-validator';
import * as overridesController from './overrides.controller.js';
import { createOverrideSlabValidation, updateOverrideSlabValidation } from './overrides.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../shared/constants/index.js';

const router = Router();
const idValidation = [param('id').isMongoId().withMessage('Invalid slab id')];
const adminOnly = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

router.get('/slabs', protect, overridesController.listSlabs);
router.post('/slabs', protect, adminOnly, createOverrideSlabValidation, validate, overridesController.createSlab);
router.patch('/slabs/:id', protect, adminOnly, idValidation, updateOverrideSlabValidation, validate, overridesController.updateSlab);
router.delete('/slabs/:id', protect, adminOnly, idValidation, validate, overridesController.removeSlab);

export default router;
