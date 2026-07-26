import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as adminService from './admin.service.js';

export const dashboard = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboard();
  return sendSuccess(res, { message: 'Dashboard stats', data: { stats } });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { role, status, kycStatus, search, page, limit } = req.query;
  const result = await adminService.getUsers({ role, status, kycStatus, search, page, limit });
  return sendSuccess(res, { message: 'Users list', data: result });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await adminService.getUserDetail(req.params.id);
  return sendSuccess(res, { message: 'User detail', data: { user } });
});

export const updateRole = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserRole(req.user, req.params.id, req.body.role);
  return sendSuccess(res, { message: 'Role updated', data: { user } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserStatus(req.user, req.params.id, req.body.status);
  return sendSuccess(res, { message: 'Status updated', data: { user } });
});

export const kycQueue = asyncHandler(async (req, res) => {
  const items = await adminService.getKycQueue();
  return sendSuccess(res, { message: 'KYC queue', data: { items } });
});

export const approveKyc = asyncHandler(async (req, res) => {
  const user = await adminService.approveKyc(req.user, req.params.id);
  return sendSuccess(res, { message: 'KYC approved', data: { user } });
});

export const rejectKyc = asyncHandler(async (req, res) => {
  const user = await adminService.rejectKyc(req.user, req.params.id, req.body.reason);
  return sendSuccess(res, { message: 'KYC rejected', data: { user } });
});

export const holdKyc = asyncHandler(async (req, res) => {
  const user = await adminService.holdKyc(req.user, req.params.id, req.body.reason);
  return sendSuccess(res, { message: 'KYC put on hold', data: { user } });
});

export const pendingInvestments = asyncHandler(async (req, res) => {
  const items = await adminService.getPendingInvestments();
  return sendSuccess(res, { message: 'Pending investments', data: { items } });
});

export const listInvestments = asyncHandler(async (req, res) => {
  const { status, planType, search, page, limit } = req.query;
  const result = await adminService.getInvestments({ status, planType, search, page, limit });
  return sendSuccess(res, { message: 'Investments list', data: result });
});

export const approveInvestment = asyncHandler(async (req, res) => {
  const investment = await adminService.approveInvestment(req.user, req.params.id);
  return sendSuccess(res, { message: 'Investment approved', data: { investment } });
});

export const rejectInvestment = asyncHandler(async (req, res) => {
  const investment = await adminService.rejectInvestment(req.user, req.params.id, req.body.reason);
  return sendSuccess(res, { message: 'Investment rejected', data: { investment } });
});
