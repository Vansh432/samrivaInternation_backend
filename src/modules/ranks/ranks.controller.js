import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import * as ranksService from './ranks.service.js';

export const myRankStatus = asyncHandler(async (req, res) => {
  const data = await ranksService.getMyRankStatus(req.user._id);
  return sendSuccess(res, { message: 'My rank status', data });
});

export const listSlabs = asyncHandler(async (req, res) => {
  const slabs = await ranksService.getSlabs();
  return sendSuccess(res, { message: 'Rank qualification slabs', data: { slabs } });
});

export const createSlab = asyncHandler(async (req, res) => {
  const slab = await ranksService.createSlab(req.body, req.user._id);
  return sendSuccess(res, { statusCode: 201, message: 'Rank slab created', data: { slab } });
});

export const updateSlab = asyncHandler(async (req, res) => {
  const slab = await ranksService.updateSlab(req.params.id, req.body, req.user._id);
  return sendSuccess(res, { message: 'Rank slab updated', data: { slab } });
});

export const removeSlab = asyncHandler(async (req, res) => {
  await ranksService.deleteSlab(req.params.id, req.user._id);
  return sendSuccess(res, { message: 'Rank slab deleted' });
});

export const recalculate = asyncHandler(async (req, res) => {
  const result = await ranksService.recalculateAllRanks();
  await logEvent({
    type: 'admin', action: 'ranks.recalculated.manual',
    message: `Ranks manually recalculated — ${result.changed} of ${result.scanned} users changed rank`,
    actor: req.user._id, meta: result,
  });
  return sendSuccess(res, { message: 'Ranks recalculated', data: result });
});

export const myRankBenefits = asyncHandler(async (req, res) => {
  const data = await ranksService.getMyRankBenefits(req.user._id);
  return sendSuccess(res, { message: 'My rank benefits', data });
});

export const listBenefitSlabs = asyncHandler(async (req, res) => {
  const slabs = await ranksService.getBenefitSlabs();
  return sendSuccess(res, { message: 'Rank benefit slabs', data: { slabs } });
});

export const createBenefitSlab = asyncHandler(async (req, res) => {
  const slab = await ranksService.createBenefitSlab(req.body, req.user._id);
  return sendSuccess(res, { statusCode: 201, message: 'Rank benefit slab created', data: { slab } });
});

export const updateBenefitSlab = asyncHandler(async (req, res) => {
  const slab = await ranksService.updateBenefitSlab(req.params.id, req.body, req.user._id);
  return sendSuccess(res, { message: 'Rank benefit slab updated', data: { slab } });
});

export const removeBenefitSlab = asyncHandler(async (req, res) => {
  await ranksService.deleteBenefitSlab(req.params.id, req.user._id);
  return sendSuccess(res, { message: 'Rank benefit slab deleted' });
});

export const evaluateBenefits = asyncHandler(async (req, res) => {
  const result = await ranksService.evaluateMonthlyRankBenefits();
  await logEvent({
    type: 'admin', action: 'ranks.benefitsEvaluated.manual',
    message: `Rank benefits manually evaluated for ${result.yearMonth} — ${result.qualified} of ${result.scanned} users qualified`,
    actor: req.user._id, meta: result,
  });
  return sendSuccess(res, { message: 'Monthly rank benefits evaluated', data: result });
});

export const listAchievementSlabs = asyncHandler(async (req, res) => {
  const slabs = await ranksService.getAchievementSlabs();
  return sendSuccess(res, { message: 'Rank achievement slabs', data: { slabs } });
});

export const createAchievementSlab = asyncHandler(async (req, res) => {
  const slab = await ranksService.createAchievementSlab(req.body, req.user._id);
  return sendSuccess(res, { statusCode: 201, message: 'Rank achievement slab created', data: { slab } });
});

export const updateAchievementSlab = asyncHandler(async (req, res) => {
  const slab = await ranksService.updateAchievementSlab(req.params.id, req.body, req.user._id);
  return sendSuccess(res, { message: 'Rank achievement slab updated', data: { slab } });
});

export const removeAchievementSlab = asyncHandler(async (req, res) => {
  await ranksService.deleteAchievementSlab(req.params.id, req.user._id);
  return sendSuccess(res, { message: 'Rank achievement slab deleted' });
});
