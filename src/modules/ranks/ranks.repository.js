import RankSlab from './rankSlab.model.js';
import RankBenefitSlab from './rankBenefitSlab.model.js';
import RankBenefitPayout from './rankBenefitPayout.model.js';
import RankAchievementSlab from './rankAchievementSlab.model.js';
import User from '../users/users.model.js';
import Investment from '../investments/investments.model.js';
import { INVESTMENT_STATUS, USER_STATUS, RANKS } from '../../shared/constants/index.js';

export const listRankSlabs = ({ activeOnly = false } = {}) =>
  RankSlab.find(activeOnly ? { isActive: true } : {});

export const findRankSlabById = (id) => RankSlab.findById(id);

export const findRankSlabByRank = (rank) => RankSlab.findOne({ rank });

export const createRankSlab = (payload) => RankSlab.create(payload);

export const updateRankSlabById = (id, update) =>
  RankSlab.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const deleteRankSlabById = (id) => RankSlab.findByIdAndDelete(id);

export const countRankSlabs = () => RankSlab.countDocuments();

export const insertManyRankSlabs = (rows) => RankSlab.insertMany(rows, { ordered: false });

// Lean projection for the daily recalculation pass — only the fields the algorithm needs.
export const listAllUsersForRankRecalc = () =>
  User.find({}, 'sponsor depth status rank.current rank.highestAchieved').lean();

export const bulkUpdateUserRanks = (ops) => {
  if (!ops.length) return Promise.resolve();
  return User.bulkWrite(
    ops.map(({ userId, update }) => ({ updateOne: { filter: { _id: userId }, update } })),
    { ordered: false }
  );
};

// Sum of active/matured investment units per user, for the whole platform in one query —
// mirrors the ACCRUING_STATUSES convention already used in investments.service.js.
export const sumActiveUnitsByUser = async () => {
  const rows = await Investment.aggregate([
    { $match: { status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED] } } },
    { $group: { _id: '$user', total: { $sum: '$units' } } },
  ]);
  return rows;
};

// Scoped version of the above for a single user's status card — just the given user ids
// (typically one user + their direct referrals) instead of the whole platform.
export const sumActiveUnitsForUsers = async (userIds) => {
  if (!userIds.length) return new Map();
  const rows = await Investment.aggregate([
    { $match: { user: { $in: userIds }, status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED] } } },
    { $group: { _id: '$user', total: { $sum: '$units' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
};

// Direct referrals' current status + rank, for the "my rank" progress card.
export const listDirectReferralsBasic = (directIds) =>
  User.find({ _id: { $in: directIds } }, 'status rank.current').lean();

// --- Rank Benefit Slabs (monthly perk bonuses) ---

export const listRankBenefitSlabs = ({ activeOnly = false } = {}) =>
  RankBenefitSlab.find(activeOnly ? { isActive: true } : {});

export const findRankBenefitSlabById = (id) => RankBenefitSlab.findById(id);

export const findRankBenefitSlabByRank = (rank) => RankBenefitSlab.findOne({ rank });

export const createRankBenefitSlab = (payload) => RankBenefitSlab.create(payload);

export const updateRankBenefitSlabById = (id, update) =>
  RankBenefitSlab.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const deleteRankBenefitSlabById = (id) => RankBenefitSlab.findByIdAndDelete(id);

export const countRankBenefitSlabs = () => RankBenefitSlab.countDocuments();

export const insertManyRankBenefitSlabs = (rows) => RankBenefitSlab.insertMany(rows, { ordered: false });

// Lean projection for the monthly benefit evaluation — active, ranked (non-investor) users only.
export const listActiveNonInvestorUsers = () =>
  User.find(
    { status: USER_STATUS.ACTIVE, 'rank.current': { $ne: RANKS.INVESTOR } },
    'rank.current rank.achievedAt'
  ).lean();

// --- Rank Benefit Payouts (idempotency ledger + admin audit trail) ---

export const findRankBenefitPayout = (userId, yearMonth) => RankBenefitPayout.findOne({ user: userId, yearMonth });

export const createRankBenefitPayout = (doc) => RankBenefitPayout.create(doc);

// --- Rank Achievement Slabs (one-time reward for first reaching a rank) ---

export const listRankAchievementSlabs = ({ activeOnly = false } = {}) =>
  RankAchievementSlab.find(activeOnly ? { isActive: true } : {});

export const findRankAchievementSlabById = (id) => RankAchievementSlab.findById(id);

export const findRankAchievementSlabByRank = (rank) => RankAchievementSlab.findOne({ rank });

export const createRankAchievementSlab = (payload) => RankAchievementSlab.create(payload);

export const updateRankAchievementSlabById = (id, update) =>
  RankAchievementSlab.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const deleteRankAchievementSlabById = (id) => RankAchievementSlab.findByIdAndDelete(id);

export const countRankAchievementSlabs = () => RankAchievementSlab.countDocuments();

export const insertManyRankAchievementSlabs = (rows) => RankAchievementSlab.insertMany(rows, { ordered: false });
