import { Router } from 'express';
import * as usersController from './users.controller.js';
import { updateProfileValidation, submitKycValidation } from './users.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

router.patch('/profile', protect, updateProfileValidation, validate, usersController.updateProfile);
router.post('/kyc', protect, submitKycValidation, validate, usersController.submitKyc);

export default router;
