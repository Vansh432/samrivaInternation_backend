import { Router } from 'express';
import * as teamController from './team.controller.js';
import { levelParamValidation } from './team.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/summary', teamController.summary);
router.get('/level/:level', levelParamValidation, validate, teamController.levelMembers);
router.get('/tree', teamController.tree);

export default router;
