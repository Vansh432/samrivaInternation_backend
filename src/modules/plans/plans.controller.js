import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as plansService from './plans.service.js';

export const list = asyncHandler(async (req, res) => {
  const slabs = await plansService.getRateSlabs();
  return sendSuccess(res, { message: 'Rate slabs', data: { slabs } });
});

export const create = asyncHandler(async (req, res) => {
  const slab = await plansService.createSlab(req.body, req.user._id);
  return sendSuccess(res, { statusCode: 201, message: 'Rate slab created', data: { slab } });
});

export const update = asyncHandler(async (req, res) => {
  const slab = await plansService.updateSlab(req.params.id, req.body, req.user._id);
  return sendSuccess(res, { message: 'Rate slab updated', data: { slab } });
});

export const remove = asyncHandler(async (req, res) => {
  await plansService.deleteSlab(req.params.id, req.user._id);
  return sendSuccess(res, { message: 'Rate slab deleted' });
});

export const getRate = asyncHandler(async (req, res) => {
  const { units, tenure, planType } = req.query;
  const result = await plansService.resolveRate({
    planType,
    units: Number(units),
    tenureMonths: Number(tenure),
  });
  return sendSuccess(res, { message: 'Rate resolved', data: result });
});
