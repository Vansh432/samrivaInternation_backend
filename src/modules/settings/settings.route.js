import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import { updateSettingsValidation } from './settings.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../shared/constants/index.js';

const router = Router();

router.get('/', settingsController.get);
router.patch('/', protect, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), updateSettingsValidation, validate, settingsController.update);

export default router;
