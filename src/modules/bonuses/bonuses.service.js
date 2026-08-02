import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { addDays } from '../../shared/utils/dateMath.js';
import { WALLET_TYPES } from '../../shared/constants/index.js';
import { creditWallet } from '../wallets/wallets.service.js';
import { listWalletTransactionsByUser, listWalletTransactionsAdmin, countWalletTransactions } from '../wallets/walletTransactions.repository.js';
import { findUserById, updateUserById, findDirectReferralIds } from '../users/users.repository.js';
import {
  findFirstApprovedInvestment,
  sumApprovedUnitsForUsersInWindow,
  sumRenewalUnitsForUsers,
} from '../investments/investments.repository.js';
import {
  listFastStartSlabs,
  findFastStartSlabById,
  findFastStartSlabByUnitsThreshold,
  createFastStartSlab,
  updateFastStartSlabById,
  deleteFastStartSlabById,
  listRetentionSlabs,
  findRetentionSlabById,
  findRetentionSlabByUnitsThreshold,
  createRetentionSlab,
  updateRetentionSlabById,
  deleteRetentionSlabById,
  countRetentionSlabs,
  insertManyRetentionSlabs,
} from './bonuses.repository.js';

const FAST_START_WINDOW_DAYS = 30;
const FAST_START_BONUS_SOURCE = 'fast_start_bonus';
const RETENTION_BONUS_SOURCE = 'retention_bonus';

// The real tier table the user provided — seeded once if the collection is empty, fully
// admin-editable afterward, same idempotent-seed idiom as ensureDefaultRankSlabs.
const DEFAULT_RETENTION_SLABS = [
  { unitsThreshold: 100, bonusAmount: 10000 },
  { unitsThreshold: 250, bonusAmount: 30000 },
  { unitsThreshold: 500, bonusAmount: 75000 },
  { unitsThreshold: 1000, bonusAmount: 200000 },
];

export const ensureDefaultRetentionSlabs = async () => {
  const existing = await countRetentionSlabs();
  if (existing > 0) return;
  await insertManyRetentionSlabs(DEFAULT_RETENTION_SLABS);
  logger.info('bonuses.defaultRetentionSlabs.seeded', { count: DEFAULT_RETENTION_SLABS.length });
};

const toSlabDTO = (slab) => ({ units: slab.unitsThreshold, bonus: slab.bonusAmount });

// Shared by evaluateFastStartBonus (triggered on approval) and getMyFastStartBonus (read
// status) — both need the same sponsor-rooted window + direct-team-units total.
const computeSponsorWindow = async (sponsorId) => {
  const firstInv = await findFirstApprovedInvestment(sponsorId);
  if (!firstInv) return null;
  const windowStart = firstInv.startDate;
  const windowEnd = addDays(windowStart, FAST_START_WINDOW_DAYS);
  return { windowStart, windowEnd };
};

const computeCumulativeUnits = async (sponsorId, windowStart, windowEnd) => {
  const referralIds = await findDirectReferralIds(sponsorId);
  return sumApprovedUnitsForUsersInWindow(referralIds, windowStart, windowEnd);
};

// Called right after an investment is approved (see admin.service.js#approveInvestment).
// Best-effort — the caller wraps this in try/catch so a bug here can never block an
// investment approval, which is the part that matters financially first.
export const evaluateFastStartBonus = async (investment) => {
  const investor = await findUserById(investment.user);
  if (!investor?.sponsor) return;

  const sponsor = await findUserById(investor.sponsor);
  if (!sponsor) return;

  const window = await computeSponsorWindow(sponsor._id);
  if (!window) return; // sponsor hasn't started their own 30-day clock yet

  const { windowStart, windowEnd } = window;
  if (investment.startDate < windowStart || investment.startDate > windowEnd) return;

  const cumulativeUnits = await computeCumulativeUnits(sponsor._id, windowStart, windowEnd);

  const slabs = await listFastStartSlabs({ activeOnly: true }); // ascending by unitsThreshold
  if (!slabs.length) return;

  const claimed = sponsor.bonusFlags?.fastStartClaimedSlabs || [];
  const eligible = slabs.filter((s) => s.unitsThreshold <= cumulativeUnits);
  if (!eligible.length) return;

  const newlyCrossed = eligible.filter((s) => !claimed.includes(s.unitsThreshold));
  if (!newlyCrossed.length) return; // already fully paid for this level

  const previousHighestBonus = claimed.length
    ? Math.max(0, ...slabs.filter((s) => claimed.includes(s.unitsThreshold)).map((s) => s.bonusAmount))
    : 0;
  const highestSlab = eligible[eligible.length - 1];
  const creditAmount = highestSlab.bonusAmount - previousHighestBonus;

  if (creditAmount > 0) {
    await creditWallet({
      userId: sponsor._id,
      walletType: WALLET_TYPES.BONUS,
      amount: creditAmount,
      source: FAST_START_BONUS_SOURCE,
      referenceModel: 'Investment',
      referenceId: investment._id,
      description: `Fast Start Bonus — ${highestSlab.unitsThreshold} units milestone (direct team)`,
    });

    await logEvent({
      type: 'bonus',
      action: 'bonus.fastStart.credited',
      message: `Fast Start Bonus of ${creditAmount} credited (${highestSlab.unitsThreshold} units milestone)`,
      user: sponsor._id,
      meta: { unitsThreshold: highestSlab.unitsThreshold, creditAmount, cumulativeUnits, investmentId: investment._id.toString() },
    });
  }

  await updateUserById(sponsor._id, {
    $addToSet: { 'bonusFlags.fastStartClaimedSlabs': { $each: newlyCrossed.map((s) => s.unitsThreshold) } },
  });
};

// Read-only status for the mobile Bonus Center screen.
export const getMyFastStartBonus = async (userId) => {
  const slabDocs = await listFastStartSlabs({ activeOnly: true });
  const slabs = slabDocs.map(toSlabDTO);

  const window = await computeSponsorWindow(userId);
  if (!window) {
    return {
      windowDays: FAST_START_WINDOW_DAYS,
      daysElapsed: 0,
      daysRemaining: FAST_START_WINDOW_DAYS,
      isActive: false,
      unitsInWindow: 0,
      tier: { currentUnits: 0, achieved: null, next: slabs[0] || null, progress: 0 },
      earned: 0,
      slabs,
    };
  }

  const { windowStart, windowEnd } = window;
  const now = new Date();
  const daysElapsed = Math.min(FAST_START_WINDOW_DAYS, Math.max(0, Math.floor((now - windowStart) / 86400000)));
  const daysRemaining = Math.max(0, FAST_START_WINDOW_DAYS - daysElapsed);
  const isActive = now <= windowEnd;

  const cumulativeUnits = await computeCumulativeUnits(userId, windowStart, windowEnd);

  let achieved = null;
  let next = null;
  for (const slab of slabDocs) {
    if (slab.unitsThreshold <= cumulativeUnits) achieved = toSlabDTO(slab);
    else if (!next) next = toSlabDTO(slab);
  }
  const base = achieved ? achieved.units : 0;
  const progress = next ? Math.max(0, Math.min(100, Math.round(((cumulativeUnits - base) / (next.units - base)) * 100))) : achieved ? 100 : 0;

  const txns = await listWalletTransactionsByUser(userId, { source: FAST_START_BONUS_SOURCE });
  const earned = txns.reduce((sum, t) => sum + t.amount, 0);

  return {
    windowDays: FAST_START_WINDOW_DAYS,
    daysElapsed,
    daysRemaining,
    isActive,
    unitsInWindow: cumulativeUnits,
    tier: { currentUnits: cumulativeUnits, achieved, next, progress },
    earned,
    slabs,
  };
};

export const getSlabs = () => listFastStartSlabs();

export const createSlab = async (payload, actorId) => {
  const existing = await findFastStartSlabByUnitsThreshold(payload.unitsThreshold);
  if (existing) throw new AppError(`A slab for ${payload.unitsThreshold} units already exists`, 409);
  const slab = await createFastStartSlab({
    unitsThreshold: payload.unitsThreshold,
    bonusAmount: payload.bonusAmount,
    isActive: payload.isActive ?? true,
  });
  logger.info('bonuses.fastStart.slab.create.success', { id: slab._id.toString() });
  await logEvent({
    type: 'admin', action: 'bonuses.fastStart.slab.created',
    message: `Fast Start Bonus slab created (${payload.unitsThreshold} units)`,
    actor: actorId, meta: { slabId: slab._id.toString(), payload },
  });
  return slab;
};

export const updateSlab = async (id, payload, actorId) => {
  const existing = await findFastStartSlabById(id);
  if (!existing) throw new AppError('Fast Start Bonus slab not found', 404);
  if (payload.unitsThreshold !== undefined && payload.unitsThreshold !== existing.unitsThreshold) {
    const clashing = await findFastStartSlabByUnitsThreshold(payload.unitsThreshold);
    if (clashing) throw new AppError(`A slab for ${payload.unitsThreshold} units already exists`, 409);
  }
  const slab = await updateFastStartSlabById(id, payload);
  logger.info('bonuses.fastStart.slab.update.success', { id });
  await logEvent({
    type: 'admin', action: 'bonuses.fastStart.slab.updated',
    message: `Fast Start Bonus slab updated (${id})`, actor: actorId, meta: { slabId: id, changes: payload },
  });
  return slab;
};

export const deleteSlab = async (id, actorId) => {
  const existing = await findFastStartSlabById(id);
  if (!existing) throw new AppError('Fast Start Bonus slab not found', 404);
  await deleteFastStartSlabById(id);
  await logEvent({
    type: 'admin', action: 'bonuses.fastStart.slab.deleted', level: 'warn',
    message: `Fast Start Bonus slab deleted (${id})`, actor: actorId, meta: { slabId: id },
  });
  logger.info('bonuses.fastStart.slab.delete.success', { id });
};

export const getFastStartAwardsAdmin = async ({ page = 1, limit = 20 } = {}) => {
  const filter = { walletType: WALLET_TYPES.BONUS, source: FAST_START_BONUS_SOURCE };
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

// --- Retention Bonus ---

const toRetentionSlabDTO = (slab) => ({ units: slab.unitsThreshold, bonus: slab.bonusAmount });

// Called right after a renewal investment is created (see
// investments.service.js#createRenewalInvestment). Best-effort — the caller wraps this in
// try/catch so a bug here can never block the renewal itself, which is the part that
// matters financially first. Same slab-crossing/top-up shape as evaluateFastStartBonus,
// just lifetime-cumulative (no window) and keyed off renewal units instead of first-time units.
export const evaluateRetentionBonus = async (newInvestment) => {
  const renewer = await findUserById(newInvestment.user);
  if (!renewer?.sponsor) return;

  const sponsor = await findUserById(renewer.sponsor);
  if (!sponsor) return;

  const referralIds = await findDirectReferralIds(sponsor._id);
  const cumulativeUnits = await sumRenewalUnitsForUsers(referralIds);

  const slabs = await listRetentionSlabs({ activeOnly: true }); // ascending by unitsThreshold
  if (!slabs.length) return;

  const claimed = sponsor.bonusFlags?.retentionClaimedSlabs || [];
  const eligible = slabs.filter((s) => s.unitsThreshold <= cumulativeUnits);
  if (!eligible.length) return;

  const newlyCrossed = eligible.filter((s) => !claimed.includes(s.unitsThreshold));
  if (!newlyCrossed.length) return; // already fully paid for this level

  const previousHighestBonus = claimed.length
    ? Math.max(0, ...slabs.filter((s) => claimed.includes(s.unitsThreshold)).map((s) => s.bonusAmount))
    : 0;
  const highestSlab = eligible[eligible.length - 1];
  const creditAmount = highestSlab.bonusAmount - previousHighestBonus;

  if (creditAmount > 0) {
    await creditWallet({
      userId: sponsor._id,
      walletType: WALLET_TYPES.BONUS,
      amount: creditAmount,
      source: RETENTION_BONUS_SOURCE,
      referenceModel: 'Investment',
      referenceId: newInvestment._id,
      description: `Retention Bonus — ${highestSlab.unitsThreshold} units milestone (direct team renewals)`,
    });

    await logEvent({
      type: 'bonus',
      action: 'bonus.retention.credited',
      message: `Retention Bonus of ${creditAmount} credited (${highestSlab.unitsThreshold} units milestone)`,
      user: sponsor._id,
      meta: { unitsThreshold: highestSlab.unitsThreshold, creditAmount, cumulativeUnits, investmentId: newInvestment._id.toString() },
    });
  }

  await updateUserById(sponsor._id, {
    $addToSet: { 'bonusFlags.retentionClaimedSlabs': { $each: newlyCrossed.map((s) => s.unitsThreshold) } },
  });
};

// Read-only status for the mobile Bonus Center screen — no window fields, unlike Fast
// Start, since retention has no fixed clock.
export const getMyRetentionBonus = async (userId) => {
  const slabDocs = await listRetentionSlabs({ activeOnly: true });
  const slabs = slabDocs.map(toRetentionSlabDTO);

  const referralIds = await findDirectReferralIds(userId);
  const cumulativeUnits = await sumRenewalUnitsForUsers(referralIds);

  let achieved = null;
  let next = null;
  for (const slab of slabDocs) {
    if (slab.unitsThreshold <= cumulativeUnits) achieved = toRetentionSlabDTO(slab);
    else if (!next) next = toRetentionSlabDTO(slab);
  }
  const base = achieved ? achieved.units : 0;
  const progress = next ? Math.max(0, Math.min(100, Math.round(((cumulativeUnits - base) / (next.units - base)) * 100))) : achieved ? 100 : 0;

  const txns = await listWalletTransactionsByUser(userId, { source: RETENTION_BONUS_SOURCE });
  const earned = txns.reduce((sum, t) => sum + t.amount, 0);

  return {
    renewalUnits: cumulativeUnits,
    tier: { currentUnits: cumulativeUnits, achieved, next, progress },
    earned,
    slabs,
  };
};

export const getRetentionSlabs = () => listRetentionSlabs();

export const createRetentionBonusSlab = async (payload, actorId) => {
  const existing = await findRetentionSlabByUnitsThreshold(payload.unitsThreshold);
  if (existing) throw new AppError(`A slab for ${payload.unitsThreshold} units already exists`, 409);
  const slab = await createRetentionSlab({
    unitsThreshold: payload.unitsThreshold,
    bonusAmount: payload.bonusAmount,
    isActive: payload.isActive ?? true,
  });
  logger.info('bonuses.retention.slab.create.success', { id: slab._id.toString() });
  await logEvent({
    type: 'admin', action: 'bonuses.retention.slab.created',
    message: `Retention Bonus slab created (${payload.unitsThreshold} units)`,
    actor: actorId, meta: { slabId: slab._id.toString(), payload },
  });
  return slab;
};

export const updateRetentionBonusSlab = async (id, payload, actorId) => {
  const existing = await findRetentionSlabById(id);
  if (!existing) throw new AppError('Retention Bonus slab not found', 404);
  if (payload.unitsThreshold !== undefined && payload.unitsThreshold !== existing.unitsThreshold) {
    const clashing = await findRetentionSlabByUnitsThreshold(payload.unitsThreshold);
    if (clashing) throw new AppError(`A slab for ${payload.unitsThreshold} units already exists`, 409);
  }
  const slab = await updateRetentionSlabById(id, payload);
  logger.info('bonuses.retention.slab.update.success', { id });
  await logEvent({
    type: 'admin', action: 'bonuses.retention.slab.updated',
    message: `Retention Bonus slab updated (${id})`, actor: actorId, meta: { slabId: id, changes: payload },
  });
  return slab;
};

export const deleteRetentionBonusSlab = async (id, actorId) => {
  const existing = await findRetentionSlabById(id);
  if (!existing) throw new AppError('Retention Bonus slab not found', 404);
  await deleteRetentionSlabById(id);
  logger.info('bonuses.retention.slab.delete.success', { id });
  await logEvent({
    type: 'admin', action: 'bonuses.retention.slab.deleted', level: 'warn',
    message: `Retention Bonus slab deleted (${id})`, actor: actorId, meta: { slabId: id },
  });
};

export const getRetentionAwardsAdmin = async ({ page = 1, limit = 20 } = {}) => {
  const filter = { walletType: WALLET_TYPES.BONUS, source: RETENTION_BONUS_SOURCE };
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
