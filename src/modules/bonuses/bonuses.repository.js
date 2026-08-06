import FastStartBonusSlab from './fastStartBonusSlab.model.js';
import RetentionBonusSlab from './retentionBonusSlab.model.js';
import DirectAcquisitionBonusConfig from './directAcquisitionBonus.model.js';
import User from '../users/users.model.js';
import { USER_STATUS } from '../../shared/constants/index.js';

export const listFastStartSlabs = ({ activeOnly = false } = {}) =>
  FastStartBonusSlab.find(activeOnly ? { isActive: true } : {}).sort({ unitsThreshold: 1 });

export const findFastStartSlabById = (id) => FastStartBonusSlab.findById(id);

export const findFastStartSlabByUnitsThreshold = (unitsThreshold) => FastStartBonusSlab.findOne({ unitsThreshold });

export const createFastStartSlab = (payload) => FastStartBonusSlab.create(payload);

export const updateFastStartSlabById = (id, update) =>
  FastStartBonusSlab.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const deleteFastStartSlabById = (id) => FastStartBonusSlab.findByIdAndDelete(id);

export const listRetentionSlabs = ({ activeOnly = false } = {}) =>
  RetentionBonusSlab.find(activeOnly ? { isActive: true } : {}).sort({ unitsThreshold: 1 });

export const findRetentionSlabById = (id) => RetentionBonusSlab.findById(id);

export const findRetentionSlabByUnitsThreshold = (unitsThreshold) => RetentionBonusSlab.findOne({ unitsThreshold });

export const createRetentionSlab = (payload) => RetentionBonusSlab.create(payload);

export const updateRetentionSlabById = (id, update) =>
  RetentionBonusSlab.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const deleteRetentionSlabById = (id) => RetentionBonusSlab.findByIdAndDelete(id);

export const countRetentionSlabs = () => RetentionBonusSlab.countDocuments();

export const insertManyRetentionSlabs = (rows) => RetentionBonusSlab.insertMany(rows, { ordered: false });

// --- Direct Acquisition Bonus (singleton config, like Settings) ---

export const getOrCreateDirectAcquisitionConfig = () =>
  DirectAcquisitionBonusConfig.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

export const updateDirectAcquisitionConfig = async (update) => {
  await getOrCreateDirectAcquisitionConfig();
  return DirectAcquisitionBonusConfig.findOneAndUpdate({}, update, { new: true, runValidators: true });
};

// --- Fast Start Bonus settlement (see bonuses.service.js#settleFastStartBonuses) ---

// Active users whose Fast Start window hasn't been settled yet — the daily settlement job
// checks each one's own window (rooted at their own first approved investment) and only
// acts once it has actually closed, so this intentionally includes users who haven't
// invested yet (computeSponsorWindow just returns null for them, cheaply skipped).
export const listFastStartSettlementCandidates = ({ userIds } = {}) =>
  User.find(
    {
      status: USER_STATUS.ACTIVE,
      'bonusFlags.fastStartSettledAt': null,
      ...(userIds ? { _id: { $in: userIds } } : {}),
    },
    '_id rank.current bonusFlags.fastStartClaimedSlabs'
  ).lean();

export const markFastStartSettled = (userId) =>
  User.updateOne({ _id: userId }, { $set: { 'bonusFlags.fastStartSettledAt': new Date() } });
