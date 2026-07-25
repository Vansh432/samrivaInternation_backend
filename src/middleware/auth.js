import { verifyAccessToken } from '../shared/utils/token.js';
import { AppError } from '../shared/errors/AppError.js';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
import { findUserById } from '../modules/users/users.repository.js';
import { USER_STATUS } from '../shared/constants/index.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Not authenticated', 401);
  }

  const token = header.split(' ')[1];
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await findUserById(payload.sub);
  if (!user) throw new AppError('User no longer exists', 401);
  if (user.tokenVersion !== payload.tokenVersion) throw new AppError('Session expired, please login again', 401);
  if (user.status !== USER_STATUS.ACTIVE) throw new AppError('Account is not active', 403);

  req.user = user;
  next();
});

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You are not authorized to perform this action', 403));
  }
  next();
};
