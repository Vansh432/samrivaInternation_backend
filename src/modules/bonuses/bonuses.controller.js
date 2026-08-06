import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as bonusesService from './bonuses.service.js';

export const myFastStart = asyncHandler(async (req, res) => {
  const status = await bonusesService.getMyFastStartBonus(req.user._id);
  return sendSuccess(res, { message: 'Fast Start Bonus status', data: status });
});

export const listSlabs = asyncHandler(async (req, res) => {
  const slabs = await bonusesService.getSlabs();
  return sendSuccess(res, { message: 'Fast Start Bonus slabs', data: { slabs } });
});

export const createSlab = asyncHandler(async (req, res) => {
  const slab = await bonusesService.createSlab(req.body, req.user._id);
  return sendSuccess(res, { statusCode: 201, message: 'Fast Start Bonus slab created', data: { slab } });
});

export const updateSlab = asyncHandler(async (req, res) => {
  const slab = await bonusesService.updateSlab(req.params.id, req.body, req.user._id);
  return sendSuccess(res, { message: 'Fast Start Bonus slab updated', data: { slab } });
});

export const removeSlab = asyncHandler(async (req, res) => {
  await bonusesService.deleteSlab(req.params.id, req.user._id);
  return sendSuccess(res, { message: 'Fast Start Bonus slab deleted' });
});

export const listAwards = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await bonusesService.getFastStartAwardsAdmin({ page, limit });
  return sendSuccess(res, { message: 'Fast Start Bonus awards', data: result });
});

export const myRetention = asyncHandler(async (req, res) => {
  const status = await bonusesService.getMyRetentionBonus(req.user._id);
  return sendSuccess(res, { message: 'Retention Bonus status', data: status });
});

export const listRetentionSlabs = asyncHandler(async (req, res) => {
  const slabs = await bonusesService.getRetentionSlabs();
  return sendSuccess(res, { message: 'Retention Bonus slabs', data: { slabs } });
});

export const createRetentionSlab = asyncHandler(async (req, res) => {
  const slab = await bonusesService.createRetentionBonusSlab(req.body, req.user._id);
  return sendSuccess(res, { statusCode: 201, message: 'Retention Bonus slab created', data: { slab } });
});

export const updateRetentionSlab = asyncHandler(async (req, res) => {
  const slab = await bonusesService.updateRetentionBonusSlab(req.params.id, req.body, req.user._id);
  return sendSuccess(res, { message: 'Retention Bonus slab updated', data: { slab } });
});

export const removeRetentionSlab = asyncHandler(async (req, res) => {
  await bonusesService.deleteRetentionBonusSlab(req.params.id, req.user._id);
  return sendSuccess(res, { message: 'Retention Bonus slab deleted' });
});

export const listRetentionAwards = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await bonusesService.getRetentionAwardsAdmin({ page, limit });
  return sendSuccess(res, { message: 'Retention Bonus awards', data: result });
});

export const getDirectAcquisitionConfig = asyncHandler(async (req, res) => {
  const config = await bonusesService.getDirectAcquisitionConfig();
  return sendSuccess(res, { message: 'Direct Acquisition Bonus config', data: { config } });
});

export const updateDirectAcquisitionConfig = asyncHandler(async (req, res) => {
  const config = await bonusesService.updateDirectAcquisitionConfig(req.body, req.user._id);
  return sendSuccess(res, { message: 'Direct Acquisition Bonus config updated', data: { config } });
});
