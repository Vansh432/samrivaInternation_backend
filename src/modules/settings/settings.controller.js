import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as settingsService from './settings.service.js';

export const get = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  return sendSuccess(res, { message: 'Platform settings', data: { settings } });
});

export const update = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.user, req.body);
  return sendSuccess(res, { message: 'Settings updated', data: { settings } });
});
