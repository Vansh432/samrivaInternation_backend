import User from './users.model.js';
import { ROLES, KYC_STATUS, USER_STATUS } from '../../shared/constants/index.js';

export const findUserByMobile = (mobile, { withPassword = false } = {}) => {
  const query = User.findOne({ mobile });
  return withPassword ? query.select('+password') : query;
};

export const findUserById = (id) => User.findById(id);

export const findUserByReferralCode = (referralCode) => User.findOne({ referralCode });

export const createUser = (payload) => User.create(payload);

export const updateUserById = (id, update) =>
  User.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const incrementTokenVersion = (id) =>
  User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true });

export const listUsers = ({ filter = {}, skip = 0, limit = 20, sort = '-createdAt' } = {}) =>
  User.find(filter).sort(sort).skip(skip).limit(limit).lean();

export const countUsers = (filter = {}) => User.countDocuments(filter);

export const getDashboardCounts = async () => {
  const [
    totalUsers,
    totalInvestors,
    totalWealthPartners,
    totalAdmins,
    pendingKyc,
    submittedKyc,
    approvedKyc,
    rejectedKyc,
    activeUsers,
    suspendedUsers,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: ROLES.INVESTOR }),
    User.countDocuments({ role: ROLES.WEALTH_PARTNER }),
    User.countDocuments({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } }),
    User.countDocuments({ 'kyc.status': KYC_STATUS.PENDING }),
    User.countDocuments({ 'kyc.status': KYC_STATUS.SUBMITTED }),
    User.countDocuments({ 'kyc.status': KYC_STATUS.APPROVED }),
    User.countDocuments({ 'kyc.status': KYC_STATUS.REJECTED }),
    User.countDocuments({ status: USER_STATUS.ACTIVE }),
    User.countDocuments({ status: USER_STATUS.SUSPENDED }),
  ]);

  return {
    totalUsers,
    totalInvestors,
    totalWealthPartners,
    totalAdmins,
    pendingKyc,
    submittedKyc,
    approvedKyc,
    rejectedKyc,
    activeUsers,
    suspendedUsers,
  };
};
