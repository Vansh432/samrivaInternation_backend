import LeadershipOverrideSlab from './leadershipOverrideSlab.model.js';

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
