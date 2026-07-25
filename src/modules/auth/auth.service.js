import bcrypt from 'bcryptjs';
import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../shared/utils/token.js';
import { generateReferralCode } from '../../shared/utils/referralCode.js';
import { USER_STATUS } from '../../shared/constants/index.js';
import {
  findUserByMobile,
  findUserById,
  findUserByReferralCode,
  createUser,
  incrementTokenVersion,
} from '../users/users.repository.js';

const issueTokens = (user) => ({
  accessToken: generateAccessToken(user),
  refreshToken: generateRefreshToken(user),
});

const buildUniqueReferralCode = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const existing = await findUserByReferralCode(code);
    if (!existing) return code;
  }
  throw new AppError('Could not generate a unique referral code, please try again', 500);
};

export const registerUser = async ({ mobile, password, role, sponsorId }) => {
  logger.info('auth.register.attempt', { mobile });

  const existing = await findUserByMobile(mobile);
  if (existing) {
    logger.warn('auth.register.duplicate', { mobile });
    throw new AppError('Mobile number is already registered', 409);
  }

  let sponsor = null;
  if (sponsorId) {
    sponsor = await findUserByReferralCode(sponsorId);
    if (!sponsor) {
      logger.warn('auth.register.invalidSponsor', { mobile, sponsorId });
      throw new AppError('Invalid sponsor ID', 400);
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const referralCode = await buildUniqueReferralCode();

  const user = await createUser({
    mobile,
    password: hashedPassword,
    role,
    referralCode,
    sponsor: sponsor?._id || null,
    ancestors: sponsor ? [sponsor._id, ...sponsor.ancestors] : [],
    depth: sponsor ? sponsor.depth + 1 : 0,
  });

  const tokens = issueTokens(user);
  logger.info('auth.register.success', { userId: user._id.toString(), mobile });
  return { user, ...tokens };
};

export const loginUser = async ({ mobile, password }) => {
  logger.info('auth.login.attempt', { mobile });

  const user = await findUserByMobile(mobile, { withPassword: true });
  if (!user) {
    logger.warn('auth.login.notFound', { mobile });
    throw new AppError('Invalid mobile number or password', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn('auth.login.badPassword', { mobile });
    throw new AppError('Invalid mobile number or password', 401);
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    logger.warn('auth.login.inactiveAccount', { mobile, status: user.status });
    throw new AppError('Account is not active, please contact support', 403);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = issueTokens(user);
  logger.info('auth.login.success', { userId: user._id.toString(), mobile });
  return { user, ...tokens };
};

export const refreshTokens = async (refreshToken) => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    logger.warn('auth.refresh.invalidToken');
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await findUserById(payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    logger.warn('auth.refresh.stale', { userId: payload.sub });
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const tokens = issueTokens(user);
  logger.info('auth.refresh.success', { userId: user._id.toString() });
  return { user, ...tokens };
};

export const logoutUser = async (userId) => {
  await incrementTokenVersion(userId);
  logger.info('auth.logout.success', { userId: userId.toString() });
};
