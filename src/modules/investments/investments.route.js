import { Router } from 'express';
import * as investmentsController from './investments.controller.js';
import { createInvestmentValidation, investmentIdValidation } from './investments.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/summary', investmentsController.summary);
router.get('/', investmentsController.list);
router.post('/', createInvestmentValidation, validate, investmentsController.create);
router.get('/:id', investmentIdValidation, validate, investmentsController.getById);

export default router;
