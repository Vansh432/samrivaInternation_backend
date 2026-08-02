import FastStartBonusSlab from './fastStartBonusSlab.model.js';
import RetentionBonusSlab from './retentionBonusSlab.model.js';

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
