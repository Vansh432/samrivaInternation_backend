import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as usersService from './users.service.js';

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await usersService.updateProfile(req.user._id, req.body);
  return sendSuccess(res, { message: 'Profile updated', data: { user } });
});

export const submitKyc = asyncHandler(async (req, res) => {
  const user = await usersService.submitKyc(req.user._id, req.body);
  return sendSuccess(res, { message: 'KYC submitted for review', data: { user } });
});
