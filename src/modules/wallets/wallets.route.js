import { Router } from 'express';
import * as walletsController from './wallets.controller.js';
import { listMyTransactionsValidation, transferToMainValidation } from './wallets.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

router.get('/balances', protect, walletsController.balances);
router.get('/transactions', protect, listMyTransactionsValidation, validate, walletsController.transactions);
router.post('/transfer-to-main', protect, transferToMainValidation, validate, walletsController.transferToMain);

export default router;
