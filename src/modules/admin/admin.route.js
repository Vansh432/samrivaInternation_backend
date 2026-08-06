import { Router } from 'express';
import * as adminController from './admin.controller.js';
import {
  listUsersValidation,
  userIdParamValidation,
  updateRoleValidation,
  updateStatusValidation,
  kycActionValidation,
  rejectKycValidation,
  holdKycValidation,
  investmentActionValidation,
  rejectInvestmentValidation,
  listInvestmentsAdminValidation,
  teamUserIdValidation,
  teamLevelValidation,
  listWalletTransactionsAdminValidation,
  listActivityLogsValidation,
  transferRequestActionValidation,
  rejectTransferRequestValidation,
  listTransferRequestsAdminValidation,
} from './admin.validation.js';
import { validate } from '../../middleware/validate.js';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../shared/constants/index.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get('/dashboard', adminController.dashboard);

router.get('/users', listUsersValidation, validate, adminController.listUsers);
router.get('/users/:id', userIdParamValidation, validate, adminController.getUser);
router.patch('/users/:id/status', updateStatusValidation, validate, adminController.updateStatus);
// Role changes are the most sensitive lever a "controls everything" admin has — restrict to super_admin only.
router.patch('/users/:id/role', authorize(ROLES.SUPER_ADMIN), updateRoleValidation, validate, adminController.updateRole);

router.get('/kyc-queue', adminController.kycQueue);
router.post('/kyc/:id/approve', kycActionValidation, validate, adminController.approveKyc);
router.post('/kyc/:id/reject', rejectKycValidation, validate, adminController.rejectKyc);
router.post('/kyc/:id/hold', holdKycValidation, validate, adminController.holdKyc);

router.get('/investments', listInvestmentsAdminValidation, validate, adminController.listInvestments);
router.get('/investments/pending', adminController.pendingInvestments);
router.post('/investments/:id/approve', investmentActionValidation, validate, adminController.approveInvestment);
router.post('/investments/:id/reject', rejectInvestmentValidation, validate, adminController.rejectInvestment);

router.get('/team/:userId/summary', teamUserIdValidation, validate, adminController.teamSummary);
router.get('/team/:userId/level/:level', teamLevelValidation, validate, adminController.teamLevelMembers);
router.get('/team/:userId/tree', teamUserIdValidation, validate, adminController.teamTree);

router.get('/wallets/transactions', listWalletTransactionsAdminValidation, validate, adminController.walletTransactions);

router.get('/wallet-transfer-requests', listTransferRequestsAdminValidation, validate, adminController.transferRequests);
router.post('/wallet-transfer-requests/:id/approve', transferRequestActionValidation, validate, adminController.approveTransferRequest);
router.post('/wallet-transfer-requests/:id/reject', rejectTransferRequestValidation, validate, adminController.rejectTransferRequest);

router.get('/logs', listActivityLogsValidation, validate, adminController.activityLogs);

export default router;
