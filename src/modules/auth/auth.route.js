import { Router } from 'express';
import * as authController from './auth.controller.js';
import { registerValidation, loginValidation, refreshValidation } from './auth.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/refresh', refreshValidation, validate, authController.refresh);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.me);

export default router;
