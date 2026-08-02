import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { KYC_STATUS, INVESTMENT_STATUS } from '../../shared/constants/index.js';
import {
  listUsers,
  countUsers,
  findUserById,
  updateUserById,
  getDashboardCounts,
} from '../users/users.repository.js';
import {
  listInvestmentsByStatus,
  findInvestmentById,
  listInvestmentsAdmin,
  countInvestmentsAdmin,
} from '../investments/investments.repository.js';
import { addMonths, toInvestmentJSON } from '../investments/investments.service.js';
import { getTeamSummary, getTeamLevelMembers, getTeamTree } from '../team/team.service.js';
import { generateInvestmentCertificate } from '../certificates/certificate.service.js';
import { evaluateFastStartBonus } from '../bonuses/bonuses.service.js';
import { evaluateLeadershipOverride } from '../overrides/overrides.service.js';
import { evaluateRankIncome } from '../ranks/ranks.service.js';
import { listWalletTransactionsAdmin, countWalletTransactions } from '../wallets/walletTransactions.repository.js';
import { listLogsAdmin, countLogs } from '../../shared/utils/systemLog.js';
import { getNextSequence, getNextSequenceRange, padSequence } from '../../shared/utils/sequence.js';

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
  await logEvent({
    type: 'admin', action: 'admin.updateUserRole',
    message: `Role changed to ${role}`, user: userId, actor: adminUser._id, meta: { role },
  });
  return user;
};

export const updateUserStatus = async (adminUser, userId, status) => {
  if (userId === adminUser._id.toString()) throw new AppError('You cannot change your own status', 400);
  const user = await updateUserById(userId, { status });
  if (!user) throw new AppError('User not found', 404);
  logger.info('admin.updateUserStatus', { adminId: adminUser._id.toString(), userId, status });
  await logEvent({
    type: 'admin', action: 'admin.updateUserStatus',
    message: `Status changed to ${status}`, user: userId, actor: adminUser._id, meta: { status },
  });
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

  // Investor ID / Folio No are assigned exactly once, the moment someone becomes a real
  // investor — reused across every certificate they ever receive (see certificate.service.js).
  if (!user.investorId) {
    user.investorId = `INV${padSequence(await getNextSequence('investorId'))}`;
  }
  if (!user.folioNumber) {
    user.folioNumber = `F${padSequence(await getNextSequence('folioNumber'))}`;
  }
  await user.save();

  logger.info('admin.approveKyc', { adminId: adminUser._id.toString(), userId });
  await logEvent({
    type: 'admin', action: 'admin.approveKyc',
    message: 'KYC approved', user: userId, actor: adminUser._id,
  });
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
  await logEvent({
    type: 'admin', action: 'admin.rejectKyc', level: 'warn',
    message: 'KYC rejected', user: userId, actor: adminUser._id, meta: { reason },
  });
  return user;
};

export const getPendingInvestments = async () => {
  const items = await listInvestmentsByStatus(INVESTMENT_STATUS.PENDING_VERIFICATION);
  return items.map(toInvestmentJSON);
};

export const getInvestments = async ({ status, planType, search, page = 1, limit = 20 }) => {
  const filter = {};
  if (status) filter.status = status;
  if (planType) filter.planType = planType;

  if (search) {
    const matchingUsers = await listUsers({
      filter: {
        $or: [
          { mobile: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
        ],
      },
      limit: 200,
    });
    filter.$or = [
      { certificateNumber: { $regex: search, $options: 'i' } },
      { transactionId: { $regex: search, $options: 'i' } },
      { user: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    listInvestmentsAdmin({ filter, skip, limit: limitNum }),
    countInvestmentsAdmin(filter),
  ]);

  return {
    items: items.map(toInvestmentJSON),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};

export const approveInvestment = async (adminUser, investmentId, baseUrl) => {
  const investment = await findInvestmentById(investmentId);
  if (!investment) throw new AppError('Investment not found', 404);
  if (investment.status !== INVESTMENT_STATUS.PENDING_VERIFICATION) {
    throw new AppError('Investment is not pending verification', 400);
  }

  const startDate = new Date();
  investment.status = INVESTMENT_STATUS.ACTIVE;
  investment.startDate = startDate;
  investment.maturityDate = addMonths(startDate, investment.tenureMonths);
  investment.dateOfAllotment = startDate;
  investment.redemptionDate = investment.maturityDate;
  investment.reviewedBy = adminUser._id;
  investment.reviewedAt = new Date();
  investment.rejectionReason = undefined;

  // Sequential debenture numbers, one per unit, reserved atomically so no two investments
  // (even approved concurrently) can ever end up with an overlapping range.
  const { start, end } = await getNextSequenceRange('debentureNo', investment.units);
  investment.debentureNoStart = `D${padSequence(start)}`;
  investment.debentureNoEnd = `D${padSequence(end)}`;

  // Certificate generation is best-effort — a failure here (e.g. a transient disk issue)
  // must never block the investor's tenure from actually starting, since that's the part
  // that matters financially. The Download button just shows "not available yet" if this
  // didn't run; it isn't retried automatically.
  const investor = await findUserById(investment.user);
  try {
    const relativePath = await generateInvestmentCertificate(investment, investor);
    investment.certificatePdfUrl = baseUrl ? `${baseUrl}${relativePath}` : relativePath;
  } catch (err) {
    logger.error('admin.approveInvestment.certificateGenerationFailed', { investmentId, error: err.message });
  }

  await investment.save();

  // Best-effort, same as certificate generation above — a Fast Start Bonus evaluation bug
  // must never block the investment's tenure from actually starting.
  try {
    await evaluateFastStartBonus(investment);
  } catch (err) {
    logger.error('admin.approveInvestment.fastStartBonusFailed', { investmentId, error: err.message });
  }

  // Same best-effort pattern — a Leadership Override evaluation bug must never block the
  // investment's tenure from actually starting.
  try {
    await evaluateLeadershipOverride(investment);
  } catch (err) {
    logger.error('admin.approveInvestment.leadershipOverrideFailed', { investmentId, error: err.message });
  }

  // Same best-effort pattern — a Rank Income evaluation bug must never block the
  // investment's tenure from actually starting.
  try {
    await evaluateRankIncome(investment);
  } catch (err) {
    logger.error('admin.approveInvestment.rankIncomeFailed', { investmentId, error: err.message });
  }

  await logEvent({
    type: 'investment',
    action: 'investment.approved',
    message: `Investment ${investment.certificateNumber} approved — tenure started`,
    user: investment.user,
    actor: adminUser._id,
    meta: { investmentId: investment._id.toString(), maturityDate: investment.maturityDate },
  });

  return toInvestmentJSON(investment);
};

export const rejectInvestment = async (adminUser, investmentId, reason) => {
  const investment = await findInvestmentById(investmentId);
  if (!investment) throw new AppError('Investment not found', 404);
  if (investment.status !== INVESTMENT_STATUS.PENDING_VERIFICATION) {
    throw new AppError('Investment is not pending verification', 400);
  }

  investment.status = INVESTMENT_STATUS.REJECTED;
  investment.reviewedBy = adminUser._id;
  investment.reviewedAt = new Date();
  investment.rejectionReason = reason;
  await investment.save();

  await logEvent({
    type: 'investment',
    action: 'investment.rejected',
    message: `Investment ${investment.certificateNumber} rejected`,
    user: investment.user,
    actor: adminUser._id,
    meta: { investmentId: investment._id.toString(), reason },
  });

  return toInvestmentJSON(investment);
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
  await logEvent({
    type: 'admin', action: 'admin.holdKyc', level: 'warn',
    message: 'KYC put on hold', user: userId, actor: adminUser._id, meta: { reason },
  });
  return user;
};

// Team/Genealogy for an arbitrary user — identical computation to the mobile self-service
// endpoints in team.service.js, just rooted at :userId instead of req.user._id.
export const getUserTeamSummary = (userId) => getTeamSummary(userId);
export const getUserTeamLevelMembers = (userId, level, { page, limit } = {}) =>
  getTeamLevelMembers(userId, level, { page, limit });
export const getUserTeamTree = (userId) => getTeamTree(userId);

export const getWalletTransactionsAdmin = async ({ walletType, type, search, dateFrom, dateTo, page = 1, limit = 20 }) => {
  const filter = {};
  if (walletType) filter.walletType = walletType;
  if (type) filter.type = type;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  if (search) {
    const matchingUsers = await listUsers({
      filter: {
        $or: [
          { mobile: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
        ],
      },
      limit: 200,
    });
    filter.user = { $in: matchingUsers.map((u) => u._id) };
  }

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    listWalletTransactionsAdmin({ filter, skip, limit: limitNum }),
    countWalletTransactions(filter),
  ]);

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};

export const getActivityLogsAdmin = async ({ type, level, action, dateFrom, dateTo, search, page = 1, limit = 20 }) => {
  const filter = {};
  if (type) filter.type = type;
  if (level) filter.level = level;
  if (action) filter.action = action;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  if (search) {
    const matchingUsers = await listUsers({
      filter: {
        $or: [
          { mobile: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
        ],
      },
      limit: 200,
    });
    const matchingUserIds = matchingUsers.map((u) => u._id);
    filter.$or = [
      { message: { $regex: search, $options: 'i' } },
      { action: { $regex: search, $options: 'i' } },
      { user: { $in: matchingUserIds } },
      { actor: { $in: matchingUserIds } },
    ];
  }

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    listLogsAdmin({ filter, skip, limit: limitNum }),
    countLogs(filter),
  ]);

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};
