import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { PLAN_TYPES } from '../../shared/constants/index.js';
import {
  listRateSlabs,
  findRateSlabById,
  createRateSlab,
  updateRateSlabById,
  deleteRateSlabById,
  findMatchingRateSlab,
} from './plans.repository.js';

const rangesOverlap = (a, b) => {
  const aMax = a.maxUnits ?? Infinity;
  const bMax = b.maxUnits ?? Infinity;
  const unitsOverlap = a.minUnits <= bMax && b.minUnits <= aMax;
  const tenureOverlap = a.tenureMonths.some((t) => b.tenureMonths.includes(t));
  return unitsOverlap && tenureOverlap;
};

const assertNoOverlap = async (candidate, excludeId) => {
  const existing = await listRateSlabs({ activeOnly: true });
  const conflict = existing.find(
    (slab) => slab._id.toString() !== String(excludeId || '') && rangesOverlap(candidate, slab)
  );
  if (conflict) {
    throw new AppError(
      `This overlaps an existing active slab (units ${conflict.minUnits}-${conflict.maxUnits ?? 'above'}, tenure ${conflict.tenureMonths.join('/')} months)`,
      409
    );
  }
};

export const getRateSlabs = () => listRateSlabs();

export const createSlab = async (payload) => {
  logger.info('plans.create.attempt', payload);
  const candidate = {
    minUnits: payload.minUnits,
    maxUnits: payload.maxUnits ?? null,
    tenureMonths: payload.tenureMonths,
  };
  if (payload.isActive !== false) await assertNoOverlap(candidate);

  const slab = await createRateSlab({
    minUnits: payload.minUnits,
    maxUnits: payload.maxUnits ?? null,
    tenureMonths: payload.tenureMonths,
    compoundingRatePercent: payload.compoundingRatePercent,
    monthlyIncomeRatePercent: payload.monthlyIncomeRatePercent,
    isActive: payload.isActive ?? true,
  });
  logger.info('plans.create.success', { id: slab._id.toString() });
  return slab;
};

export const updateSlab = async (id, payload) => {
  logger.info('plans.update.attempt', { id, ...payload });
  const existing = await findRateSlabById(id);
  if (!existing) throw new AppError('Rate slab not found', 404);

  const candidate = {
    minUnits: payload.minUnits ?? existing.minUnits,
    maxUnits: payload.maxUnits !== undefined ? payload.maxUnits : existing.maxUnits,
    tenureMonths: payload.tenureMonths ?? existing.tenureMonths,
  };
  const willBeActive = payload.isActive ?? existing.isActive;
  if (willBeActive) await assertNoOverlap(candidate, id);

  const slab = await updateRateSlabById(id, payload);
  logger.info('plans.update.success', { id });
  return slab;
};

export const deleteSlab = async (id) => {
  const existing = await findRateSlabById(id);
  if (!existing) throw new AppError('Rate slab not found', 404);
  await deleteRateSlabById(id);
  logger.info('plans.delete.success', { id });
};

export const resolveRate = async ({ planType, units, tenureMonths }) => {
  const slab = await findMatchingRateSlab({ units, tenureMonths });
  if (!slab) {
    throw new AppError('No rate is configured for the selected units and tenure', 404);
  }
  const ratePercent =
    planType === PLAN_TYPES.COMPOUNDING ? slab.compoundingRatePercent : slab.monthlyIncomeRatePercent;
  return { ratePercent, slabId: slab._id.toString(), minUnits: slab.minUnits, maxUnits: slab.maxUnits };
};
