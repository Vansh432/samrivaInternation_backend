import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { addDays } from '../../shared/utils/dateMath.js';
import { WALLET_TYPES, USER_STATUS, PLAN_TYPES, RANKS } from '../../shared/constants/index.js';
import { creditWallet, creditWalletPending } from '../wallets/wallets.service.js';
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
  getOrCreateDirectAcquisitionConfig,
  updateDirectAcquisitionConfig as updateDirectAcquisitionConfigRepo,
  listFastStartSettlementCandidates,
  markFastStartSettled,
} from './bonuses.repository.js';

// A rank at or above Associate — the floor for every income stream except Direct
// Acquisition Bonus (see bonuses.service.js#evaluateDirectAcquisitionBonus, which is
// deliberately ungated). Rank Income/Leadership Override/Rank Benefits/Rank Achievement
// already exclude Investor by their own mechanics; Fast Start and Retention need this
// explicit check since they don't otherwise look at the earner's rank at all.
const isAssociateOrAbove = (rank) => !!rank && rank !== RANKS.INVESTOR;

const FAST_START_WINDOW_DAYS = 30;
const FAST_START_BONUS_SOURCE = 'fast_start_bonus';
const RETENTION_BONUS_SOURCE = 'retention_bonus';
const DIRECT_ACQUISITION_BONUS_SOURCE = 'direct_acquisition_bonus';

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

// Settles every sponsor whose 30-day Fast Start window has closed — wallet crediting only
// ever happens here, never while the window is still open (unlike the old design, which
// topped up the wallet incrementally as each slab was crossed during the window). Runs
// daily via the cron (scheduler/fastStartSettlement.cron.js) and, under TESTING_MODE, inline
// on every /api/bonuses hit (see middleware/testingAutoProcess.js) — either way this is the
// single place Fast Start ever touches the wallet, so it can't double-pay across runs:
// bonusFlags.fastStartSettledAt is set exactly once per sponsor and gates every future run.
export const settleFastStartBonuses = async ({ userIds } = {}) => {
  const candidates = await listFastStartSettlementCandidates({ userIds });
  const slabs = await listFastStartSlabs({ activeOnly: true }); // ascending by unitsThreshold

  let settled = 0;
  let paid = 0;
  let totalPaid = 0;

  for (const user of candidates) {
    try {
      const window = await computeSponsorWindow(user._id);
      if (!window) continue; // hasn't made their own first investment yet — window hasn't started
      if (new Date() <= window.windowEnd) continue; // window still open — not time to settle yet

      // Migration guard: already paid under the old incremental-during-window design for
      // this exact window — the telescoping credits there already summed to the highest
      // slab's full bonusAmount, so mark settled with no further credit (never double-pay).
      const alreadyPaidUnderOldDesign = (user.bonusFlags?.fastStartClaimedSlabs || []).length > 0;

      if (!alreadyPaidUnderOldDesign && slabs.length) {
        const cumulativeUnits = await computeCumulativeUnits(user._id, window.windowStart, window.windowEnd);
        const eligible = slabs.filter((s) => s.unitsThreshold <= cumulativeUnits);
        const highestSlab = eligible[eligible.length - 1];

        // Rank gate: below Associate earns nothing from this stream (Direct Acquisition
        // Bonus is the only one an Investor-rank user can still earn) — the window is still
        // marked settled either way since it's now closed and can't be re-evaluated later.
        if (highestSlab && isAssociateOrAbove(user.rank?.current)) {
          await creditWallet({
            userId: user._id,
            walletType: WALLET_TYPES.BONUS,
            amount: highestSlab.bonusAmount,
            source: FAST_START_BONUS_SOURCE,
            description: `Fast Start Bonus — ${highestSlab.unitsThreshold} units milestone (30-day window closed)`,
          });
          await logEvent({
            type: 'bonus',
            action: 'bonus.fastStart.credited',
            message: `Fast Start Bonus of ${highestSlab.bonusAmount} credited (${highestSlab.unitsThreshold} units milestone)`,
            user: user._id,
            meta: { unitsThreshold: highestSlab.unitsThreshold, amount: highestSlab.bonusAmount, cumulativeUnits },
          });
          paid += 1;
          totalPaid += highestSlab.bonusAmount;
        }
      }

      await markFastStartSettled(user._id);
      settled += 1;
    } catch (err) {
      logger.error('bonuses.fastStart.settlementFailed', { userId: user._id.toString(), error: err.message });
    }
  }

  await logEvent({
    type: 'cron',
    action: 'bonuses.fastStartSettled',
    message: `Fast Start Bonus settlement completed — ${paid} paid (₹${totalPaid}), ${settled} window(s) settled`,
    meta: { settled, paid, totalPaid },
  });

  return { settled, paid, totalPaid };
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
  // Below Associate earns nothing from this stream — Direct Acquisition Bonus is the only
  // one an Investor-rank user can still earn.
  if (!isAssociateOrAbove(sponsor.rank?.current)) return;

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

// --- Direct Acquisition Bonus ---
// Official compensation-plan item: a sponsor earns a % of their DIRECT (level-1) referral's
// investment amount, rate depending on the referred investment's plan type. Uncapped, not
// rank-gated — a separate, additional payout alongside Rank Income (see
// ranks.service.js#evaluateRankIncome), not a replacement for it.

export const getDirectAcquisitionConfig = () => getOrCreateDirectAcquisitionConfig();

export const updateDirectAcquisitionConfig = async (payload, actorId) => {
  const config = await updateDirectAcquisitionConfigRepo(payload);
  await logEvent({
    type: 'admin', action: 'bonuses.directAcquisition.updated',
    message: 'Direct Acquisition Bonus config updated', actor: actorId, meta: { changes: payload },
  });
  return config;
};

// Called right after an investment is approved (see admin.service.js#approveInvestment),
// same best-effort try/catch, same single trigger point as evaluateFastStartBonus — an
// investment can only transition pending_verification -> active once, so this can never
// double-pay without needing its own idempotency flags.
export const evaluateDirectAcquisitionBonus = async (investment) => {
  const investor = await findUserById(investment.user);
  if (!investor?.sponsor) return;

  const sponsor = await findUserById(investor.sponsor);
  if (!sponsor || sponsor.status !== USER_STATUS.ACTIVE) return;

  const config = await getOrCreateDirectAcquisitionConfig();
  if (!config.isActive) return;

  const percent = investment.planType === PLAN_TYPES.COMPOUNDING ? config.compoundingPercent : config.monthlyIncomePercent;
  if (!percent) return;

  const amount = investment.principal * (percent / 100);
  if (amount <= 0) return;

  // Commission-wallet credit — goes in as 'pending', not touching the balance until the
  // next admin-configured closing date (see wallets.service.js#settlePendingCommission).
  await creditWalletPending({
    userId: sponsor._id,
    walletType: WALLET_TYPES.COMMISSION,
    amount,
    source: DIRECT_ACQUISITION_BONUS_SOURCE,
    referenceModel: 'Investment',
    referenceId: investment._id,
    description: `Direct Acquisition Bonus — ${percent}% of ${investment.certificateNumber} (${investment.planType})`,
  });

  await logEvent({
    type: 'bonus',
    action: 'bonus.directAcquisition.credited',
    message: `Direct Acquisition Bonus of ${amount} credited (${percent}% of ${investment.planType} investment)`,
    user: sponsor._id,
    meta: { percent, amount, planType: investment.planType, investmentId: investment._id.toString() },
  });
};
