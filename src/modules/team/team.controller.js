import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as teamService from './team.service.js';

export const summary = asyncHandler(async (req, res) => {
  const data = await teamService.getTeamSummary(req.user._id);
  return sendSuccess(res, { message: 'Team summary', data });
});

export const levelMembers = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const data = await teamService.getTeamLevelMembers(req.user._id, Number(req.params.level), { page, limit });
  return sendSuccess(res, { message: 'Team level members', data });
});

export const tree = asyncHandler(async (req, res) => {
  const data = await teamService.getTeamTree(req.user._id);
  return sendSuccess(res, { message: 'Team tree', data });
});
