import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as overridesService from './overrides.service.js';

export const listSlabs = asyncHandler(async (req, res) => {
  const slabs = await overridesService.getOverrideSlabs();
  return sendSuccess(res, { message: 'Leadership Override slabs', data: { slabs } });
});

export const createSlab = asyncHandler(async (req, res) => {
  const slab = await overridesService.createSlab(req.body, req.user._id);
  return sendSuccess(res, { statusCode: 201, message: 'Leadership Override slab created', data: { slab } });
});

export const updateSlab = asyncHandler(async (req, res) => {
  const slab = await overridesService.updateSlab(req.params.id, req.body, req.user._id);
  return sendSuccess(res, { message: 'Leadership Override slab updated', data: { slab } });
});

export const removeSlab = asyncHandler(async (req, res) => {
  await overridesService.deleteSlab(req.params.id, req.user._id);
  return sendSuccess(res, { message: 'Leadership Override slab deleted' });
});
