import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import { AppError } from '../../shared/errors/AppError.js';

export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No file uploaded', 400);
  // Absolute URL derived from the request itself — works unchanged whether the backend is
  // reached at localhost, a LAN IP, or the deployed Render domain.
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  return sendSuccess(res, { statusCode: 201, message: 'File uploaded', data: { url } });
});
