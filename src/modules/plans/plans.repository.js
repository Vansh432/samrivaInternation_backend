import RateSlab from './plans.model.js';

export const listRateSlabs = ({ activeOnly = false } = {}) =>
  RateSlab.find(activeOnly ? { isActive: true } : {}).sort({ minUnits: 1, tenureMonths: 1 });

export const findRateSlabById = (id) => RateSlab.findById(id);

export const createRateSlab = (payload) => RateSlab.create(payload);

export const updateRateSlabById = (id, update) =>
  RateSlab.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const deleteRateSlabById = (id) => RateSlab.findByIdAndDelete(id);

export const findMatchingRateSlab = ({ units, tenureMonths }) =>
  RateSlab.findOne({
    isActive: true,
    minUnits: { $lte: units },
    tenureMonths: tenureMonths,
    $or: [{ maxUnits: null }, { maxUnits: { $gte: units } }],
  });
