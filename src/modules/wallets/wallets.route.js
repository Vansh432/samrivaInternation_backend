import { Router } from 'express';
import * as walletsController from './wallets.controller.js';
import {
  listMyTransactionsValidation,
  createTransferRequestValidation,
  updateCommissionSettlementConfigValidation,
  updateTdsConfigValidation,
  updateAdminChargeConfigValidation,
} from './wallets.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../shared/constants/index.js';

const router = Router();
const adminOnly = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

router.get('/balances', protect, walletsController.balances);
router.get('/transactions', protect, listMyTransactionsValidation, validate, walletsController.transactions);

router.post('/transfer-requests', protect, createTransferRequestValidation, validate, walletsController.createTransferRequest);
router.get('/transfer-requests', protect, walletsController.myTransferRequests);

router.get('/commission-settlement-config', protect, walletsController.getCommissionSettlementConfig);
router.patch(
  '/commission-settlement-config',
  protect,
  adminOnly,
  updateCommissionSettlementConfigValidation,
  validate,
  walletsController.updateCommissionSettlementConfig
);

router.get('/tds-config', protect, walletsController.getTdsConfig);
router.patch('/tds-config', protect, adminOnly, updateTdsConfigValidation, validate, walletsController.updateTdsConfig);

router.get('/admin-charge-config', protect, walletsController.getAdminChargeConfig);
router.patch(
  '/admin-charge-config',
  protect,
  adminOnly,
  updateAdminChargeConfigValidation,
  validate,
  walletsController.updateAdminChargeConfig
);

export default router;
