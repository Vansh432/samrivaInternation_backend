import LeadershipOverrideSlab from './leadershipOverrideSlab.model.js';
import OverridePayout from './overridePayout.model.js';
import User from '../users/users.model.js';
import { USER_STATUS } from '../../shared/constants/index.js';

export const listOverrideSlabs = ({ activeOnly = false } = {}) =>
  LeadershipOverrideSlab.find(activeOnly ? { isActive: true } : {}).sort({ generation: 1 });

export const findOverrideSlabById = (id) => LeadershipOverrideSlab.findById(id);

export const findOverrideSlabByGeneration = (generation) => LeadershipOverrideSlab.findOne({ generation });

export const createOverrideSlab = (payload) => LeadershipOverrideSlab.create(payload);

export const updateOverrideSlabById = (id, update) =>
  LeadershipOverrideSlab.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const deleteOverrideSlabById = (id) => LeadershipOverrideSlab.findByIdAndDelete(id);

export const countOverrideSlabs = () => LeadershipOverrideSlab.countDocuments();

export const insertManyOverrideSlabs = (rows) => LeadershipOverrideSlab.insertMany(rows, { ordered: false });

// --- Monthly Leadership Override settlement (see overrides.service.js#settleLeadershipOverrides) ---

// Lean projection for the monthly scan — `ancestors` (nearest-first) already gives us
// gen1/gen2/gen3 directly, no separate sponsor lookup needed like the old per-investment design.
export const listActiveUsersForOverrideSettlement = ({ userIds } = {}) =>
  User.find(
    { status: USER_STATUS.ACTIVE, ...(userIds ? { _id: { $in: userIds } } : {}) },
    '_id status rank.current ancestors'
  ).lean();

export const findOverridePayout = (userId, generation, yearMonth) =>
  OverridePayout.findOne({ user: userId, generation, yearMonth });

export const createOverridePayout = (doc) => OverridePayout.create(doc);
