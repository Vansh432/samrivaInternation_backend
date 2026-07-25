import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import * as authService from './auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const { mobile, password, role, sponsorId } = req.body;
  const { user, accessToken, refreshToken } = await authService.registerUser({ mobile, password, role, sponsorId });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Registration successful',
    data: { user, accessToken, refreshToken },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.loginUser({ mobile, password });
  return sendSuccess(res, {
    message: 'Login successful',
    data: { user, accessToken, refreshToken },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const { user, accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(refreshToken);
  return sendSuccess(res, {
    message: 'Token refreshed',
    data: { user, accessToken, refreshToken: newRefreshToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id);
  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { message: 'Current user', data: { user: req.user } });
});
