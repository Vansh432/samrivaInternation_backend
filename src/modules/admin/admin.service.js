import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { KYC_STATUS } from '../../shared/constants/index.js';
import {
  listUsers,
  countUsers,
  findUserById,
  updateUserById,
  getDashboardCounts,
} from '../users/users.repository.js';

// listUsers/getKycQueue use .lean() for read performance, which bypasses the User model's
// toJSON transform (the one that turns _id -> id and strips __v/password everywhere else).
// Normalize here so every admin API response uses the same `id` shape as /auth/me and login.
const toPublicUser = ({ _id, __v, tokenVersion, ...rest }) => ({ id: String(_id), ...rest });

export const getDashboard = () => getDashboardCounts();

export const getUsers = async ({ role, status, kycStatus, search, page = 1, limit = 20 }) => {
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (kycStatus) filter['kyc.status'] = kycStatus;
  if (search) {
    filter.$or = [
      { mobile: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { referralCode: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    listUsers({ filter, skip, limit: limitNum }),
    countUsers(filter),
  ]);

  return {
    items: items.map(toPublicUser),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};

export const getUserDetail = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found', 404);
  return user;
};

export const updateUserRole = async (adminUser, userId, role) => {
  if (userId === adminUser._id.toString()) throw new AppError('You cannot change your own role', 400);
  const user = await updateUserById(userId, { role });
  if (!user) throw new AppError('User not found', 404);
  logger.info('admin.updateUserRole', { adminId: adminUser._id.toString(), userId, role });
  return user;
};

export const updateUserStatus = async (adminUser, userId, status) => {
  if (userId === adminUser._id.toString()) throw new AppError('You cannot change your own status', 400);
  const user = await updateUserById(userId, { status });
  if (!user) throw new AppError('User not found', 404);
  logger.info('admin.updateUserStatus', { adminId: adminUser._id.toString(), userId, status });
  return user;
};

export const getKycQueue = async () => {
  const items = await listUsers({
    filter: { 'kyc.status': KYC_STATUS.SUBMITTED },
    skip: 0,
    limit: 200,
    sort: 'kyc.submittedAt',
  });
  return items.map(toPublicUser);
};

export const approveKyc = async (adminUser, userId) => {
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found', 404);
  if (user.kyc.status !== KYC_STATUS.SUBMITTED) throw new AppError('KYC is not pending review', 400);

  user.kyc.status = KYC_STATUS.APPROVED;
  user.kyc.reviewedAt = new Date();
  user.kyc.reviewedBy = adminUser._id;
  user.kyc.rejectionReason = undefined;
  await user.save();

  logger.info('admin.approveKyc', { adminId: adminUser._id.toString(), userId });
  return user;
};

export const rejectKyc = async (adminUser, userId, reason) => {
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found', 404);
  if (user.kyc.status !== KYC_STATUS.SUBMITTED) throw new AppError('KYC is not pending review', 400);

  user.kyc.status = KYC_STATUS.REJECTED;
  user.kyc.reviewedAt = new Date();
  user.kyc.reviewedBy = adminUser._id;
  // Reused for both rejected and hold outcomes — it's the message shown to the user
  // explaining why their KYC couldn't be approved as-is (see holdKyc below).
  user.kyc.rejectionReason = reason;
  await user.save();

  logger.info('admin.rejectKyc', { adminId: adminUser._id.toString(), userId });
  return user;
};

export const holdKyc = async (adminUser, userId, reason) => {
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found', 404);
  if (user.kyc.status !== KYC_STATUS.SUBMITTED) throw new AppError('KYC is not pending review', 400);

  user.kyc.status = KYC_STATUS.HOLD;
  user.kyc.reviewedAt = new Date();
  user.kyc.reviewedBy = adminUser._id;
  user.kyc.rejectionReason = reason;
  await user.save();

  logger.info('admin.holdKyc', { adminId: adminUser._id.toString(), userId });
  return user;
};
