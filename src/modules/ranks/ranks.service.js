import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { RANKS, USER_STATUS, WALLET_TYPES } from '../../shared/constants/index.js';
import { getMonthRange } from '../../shared/utils/dateMath.js';
import {
  listRankSlabs,
  findRankSlabById,
  findRankSlabByRank,
  createRankSlab,
  updateRankSlabById,
  deleteRankSlabById,
  countRankSlabs,
  insertManyRankSlabs,
  listAllUsersForRankRecalc,
  bulkUpdateUserRanks,
  sumActiveUnitsByUser,
  sumActiveUnitsForUsers,
  listDirectReferralsBasic,
  listRankBenefitSlabs,
  findRankBenefitSlabById,
  findRankBenefitSlabByRank,
  createRankBenefitSlab,
  updateRankBenefitSlabById,
  deleteRankBenefitSlabById,
  countRankBenefitSlabs,
  insertManyRankBenefitSlabs,
  listActiveNonInvestorUsers,
  findRankBenefitPayout,
  createRankBenefitPayout,
  listRankAchievementSlabs,
  findRankAchievementSlabById,
  findRankAchievementSlabByRank,
  createRankAchievementSlab,
  updateRankAchievementSlabById,
  deleteRankAchievementSlabById,
  countRankAchievementSlabs,
  insertManyRankAchievementSlabs,
} from './ranks.repository.js';
import { findUserById, findDirectReferralIds } from '../users/users.repository.js';
import { sumApprovedUnitsForUsersInWindow } from '../investments/investments.repository.js';
import { creditWallet, creditWalletPending } from '../wallets/wallets.service.js';

// investor..national_director, in hierarchy order — index doubles as "rank strength".
const RANK_ORDER = Object.values(RANKS);
const rankIndex = (rank) => RANK_ORDER.indexOf(rank);

// The real qualification table (see career-chart.tsx's QUALIFICATION array, which this
// mirrors) — seeded once if the collection is empty; fully admin-editable afterward.
// incomePercent is this rank's slot in the 7-level Rank Income table (see
// career-chart.tsx's RANK_INCOME array, which this also mirrors, and
// ranks.service.js#evaluateRankIncome below for how it's evaluated).
const DEFAULT_SLABS = [
  { rank: RANKS.ASSOCIATE, selfUnitsMin: 1, directTeamSizeMin: 2, requiredDirectRank: RANKS.INVESTOR, teamBusinessUnitMin: 5, incomePercent: 3 },
  { rank: RANKS.SENIOR_ASSOCIATE, selfUnitsMin: 2, directTeamSizeMin: 12, requiredDirectRank: RANKS.ASSOCIATE, teamBusinessUnitMin: 75, incomePercent: 1 },
  { rank: RANKS.MANAGER, selfUnitsMin: 2, directTeamSizeMin: 10, requiredDirectRank: RANKS.SENIOR_ASSOCIATE, teamBusinessUnitMin: 1000, incomePercent: 0.85 },
  { rank: RANKS.SENIOR_MANAGER, selfUnitsMin: 4, directTeamSizeMin: 8, requiredDirectRank: RANKS.MANAGER, teamBusinessUnitMin: 0, incomePercent: 0.7 },
  { rank: RANKS.DIRECTOR, selfUnitsMin: 4, directTeamSizeMin: 6, requiredDirectRank: RANKS.SENIOR_MANAGER, teamBusinessUnitMin: 0, incomePercent: 0.55 },
  { rank: RANKS.REGIONAL_DIRECTOR, selfUnitsMin: 6, directTeamSizeMin: 4, requiredDirectRank: RANKS.DIRECTOR, teamBusinessUnitMin: 0, incomePercent: 0.4 },
  { rank: RANKS.NATIONAL_DIRECTOR, selfUnitsMin: 8, directTeamSizeMin: 2, requiredDirectRank: RANKS.REGIONAL_DIRECTOR, teamBusinessUnitMin: 0, incomePercent: 0.25 },
];

// One-time backfill for RankSlab rows that existed before incomePercent was added to the
// schema — new installs get it from DEFAULT_SLABS above via ensureDefaultRankSlabs, this
// only fills the gap for already-seeded rows (incomePercent has no schema `default`, so a
// pre-existing row reads back as undefined until backfilled).
export const ensureRankIncomePercents = async () => {
  const slabs = await listRankSlabs();
  const missing = slabs.filter((s) => typeof s.incomePercent !== 'number');
  if (!missing.length) return;
  const byRank = new Map(DEFAULT_SLABS.map((s) => [s.rank, s.incomePercent]));
  await Promise.all(
    missing.map((s) => updateRankSlabById(s._id, { incomePercent: byRank.get(s.rank) ?? 0 }))
  );
  logger.info('ranks.incomePercent.backfilled', { count: missing.length });
};

// Called right after an investment is approved (see admin.service.js#approveInvestment),
// same best-effort try/catch, same single trigger point as evaluateFastStartBonus /
// evaluateLeadershipOverride — an investment can only transition pending_verification ->
// active once, so this can never double-pay without needing its own idempotency flags.
//
// Level N's rate is RANK_ORDER[N]'s incomePercent (level 1 -> Associate's %, level 2 ->
// Senior Associate's %, ... level 7 -> National Director's %) — a rank at hierarchy
// position P (Associate=1 ... National Director=7, which is exactly rankIndex() since
// index 0 is Investor) earns every level from 1 up to P. Unlike Leadership Override (which
// starts one hop above the investor's sponsor), level 1 here IS the investor's direct
// sponsor — see the user-provided example: "direct/level one" earns the Associate rate.
export const evaluateRankIncome = async (investment) => {
  const investor = await findUserById(investment.user);
  if (!investor?.ancestors?.length) return;

  const slabs = await listRankSlabs({ activeOnly: true });
  const slabByRank = new Map(slabs.map((s) => [s.rank, s]));

  for (let level = 1; level <= 7 && level <= investor.ancestors.length; level++) {
    const earnerId = investor.ancestors[level - 1];
    const earner = await findUserById(earnerId);
    if (!earner || earner.status !== USER_STATUS.ACTIVE) continue;

    const earnerRank = earner.rank?.current || RANKS.INVESTOR;
    if (rankIndex(earnerRank) < level) continue; // hasn't reached the rank this level requires

    const levelRank = RANK_ORDER[level];
    const levelSlab = slabByRank.get(levelRank);
    if (!levelSlab?.incomePercent) continue;

    const amount = investment.principal * (levelSlab.incomePercent / 100);
    if (amount <= 0) continue;

    // Commission-wallet credit — goes in as 'pending', not touching the balance until the
    // next admin-configured closing date (see wallets.service.js#settlePendingCommission).
    await creditWalletPending({
      userId: earner._id,
      walletType: WALLET_TYPES.COMMISSION,
      amount,
      source: `rank_income_level${level}`,
      referenceModel: 'Investment',
      referenceId: investment._id,
      description: `Rank Income — Level ${level} (${levelSlab.incomePercent}% of ${investment.certificateNumber})`,
    });

    await logEvent({
      type: 'bonus',
      action: 'bonus.rankIncome.credited',
      message: `Rank Income (Level ${level}) of ${amount} credited`,
      user: earner._id,
      meta: { level, percent: levelSlab.incomePercent, amount, investmentId: investment._id.toString() },
    });
  }
};

export const ensureDefaultRankSlabs = async () => {
  const existing = await countRankSlabs();
  if (existing > 0) return;
  await insertManyRankSlabs(DEFAULT_SLABS);
  logger.info('ranks.defaultSlabs.seeded', { count: DEFAULT_SLABS.length });
};

// Field -> { source tag, human label } for the 6 monthly perk bonuses. Shared by the
// evaluation job (wallet source/description) and nowhere else — keep it colocated with the
// only place it's used.
const BENEFIT_FIELDS = [
  { field: 'mobileBonus', source: 'rank_benefit_mobile', label: 'Mobile Bonus' },
  { field: 'groomingBonus', source: 'rank_benefit_grooming', label: 'Grooming Bonus' },
  { field: 'conveyanceBonus', source: 'rank_benefit_conveyance', label: 'Conveyance Bonus' },
  { field: 'lifeStyleBonus', source: 'rank_benefit_lifestyle', label: 'Life Style Bonus' },
  { field: 'businessTourBonus', source: 'rank_benefit_business_tour', label: 'Business Tour Bonus' },
  { field: 'familyTripBonus', source: 'rank_benefit_family_trip', label: 'Family Trip Bonus' },
];

// The real rank-wise monthly benefit table the user provided — 0 means "N/a" for that
// rank. Seeded once if the collection is empty; fully admin-editable afterward.
const DEFAULT_BENEFIT_SLABS = [
  { rank: RANKS.ASSOCIATE, mobileBonus: 500, groomingBonus: 500, conveyanceBonus: 0, lifeStyleBonus: 0, businessTourBonus: 0, familyTripBonus: 0, qualifyingDirectUnitsPerMonth: 1 },
  { rank: RANKS.SENIOR_ASSOCIATE, mobileBonus: 500, groomingBonus: 1000, conveyanceBonus: 3000, lifeStyleBonus: 0, businessTourBonus: 0, familyTripBonus: 0, qualifyingDirectUnitsPerMonth: 4 },
  { rank: RANKS.MANAGER, mobileBonus: 500, groomingBonus: 2000, conveyanceBonus: 5000, lifeStyleBonus: 10000, businessTourBonus: 0, familyTripBonus: 0, qualifyingDirectUnitsPerMonth: 6 },
  { rank: RANKS.SENIOR_MANAGER, mobileBonus: 1000, groomingBonus: 5000, conveyanceBonus: 8000, lifeStyleBonus: 25000, businessTourBonus: 35000, familyTripBonus: 0, qualifyingDirectUnitsPerMonth: 8 },
  { rank: RANKS.DIRECTOR, mobileBonus: 1000, groomingBonus: 8000, conveyanceBonus: 12000, lifeStyleBonus: 50000, businessTourBonus: 75000, familyTripBonus: 100000, qualifyingDirectUnitsPerMonth: 10 },
  { rank: RANKS.REGIONAL_DIRECTOR, mobileBonus: 1000, groomingBonus: 12000, conveyanceBonus: 20000, lifeStyleBonus: 100000, businessTourBonus: 200000, familyTripBonus: 500000, qualifyingDirectUnitsPerMonth: 12 },
  { rank: RANKS.NATIONAL_DIRECTOR, mobileBonus: 1000, groomingBonus: 15000, conveyanceBonus: 50000, lifeStyleBonus: 250000, businessTourBonus: 500000, familyTripBonus: 1000000, qualifyingDirectUnitsPerMonth: 15 },
];

export const ensureDefaultRankBenefitSlabs = async () => {
  const existing = await countRankBenefitSlabs();
  if (existing > 0) return;
  await insertManyRankBenefitSlabs(DEFAULT_BENEFIT_SLABS);
  logger.info('ranks.defaultBenefitSlabs.seeded', { count: DEFAULT_BENEFIT_SLABS.length });
};

// --- Rank Achievement Bonus (one-time reward for first reaching a rank) ---

const RANK_ACHIEVEMENT_SOURCE = 'rank_achievement';

// The real one-time-earning table the user provided — seeded once if the collection is
// empty; fully admin-editable afterward.
const DEFAULT_ACHIEVEMENT_SLABS = [
  { rank: RANKS.ASSOCIATE, amount: 5000 },
  { rank: RANKS.SENIOR_ASSOCIATE, amount: 50000 },
  { rank: RANKS.MANAGER, amount: 250000 },
  { rank: RANKS.SENIOR_MANAGER, amount: 500000 },
  { rank: RANKS.DIRECTOR, amount: 2500000 },
  { rank: RANKS.REGIONAL_DIRECTOR, amount: 5000000 },
  { rank: RANKS.NATIONAL_DIRECTOR, amount: 10000000 },
];

export const ensureDefaultRankAchievementSlabs = async () => {
  const existing = await countRankAchievementSlabs();
  if (existing > 0) return;
  await insertManyRankAchievementSlabs(DEFAULT_ACHIEVEMENT_SLABS);
  logger.info('ranks.defaultAchievementSlabs.seeded', { count: DEFAULT_ACHIEVEMENT_SLABS.length });
};

export const getAchievementSlabs = () => listRankAchievementSlabs();

export const createAchievementSlab = async (payload, actorId) => {
  const existing = await findRankAchievementSlabByRank(payload.rank);
  if (existing) throw new AppError(`An achievement slab for ${payload.rank} already exists`, 409);
  const slab = await createRankAchievementSlab(payload);
  await logEvent({
    type: 'admin', action: 'ranks.achievementSlab.created',
    message: `Rank achievement slab created (${payload.rank})`, actor: actorId, meta: { slabId: slab._id.toString(), payload },
  });
  return slab;
};

export const updateAchievementSlab = async (id, payload, actorId) => {
  const existing = await findRankAchievementSlabById(id);
  if (!existing) throw new AppError('Rank achievement slab not found', 404);
  const slab = await updateRankAchievementSlabById(id, payload);
  await logEvent({
    type: 'admin', action: 'ranks.achievementSlab.updated',
    message: `Rank achievement slab updated (${existing.rank})`, actor: actorId, meta: { slabId: id, changes: payload },
  });
  return slab;
};

export const deleteAchievementSlab = async (id, actorId) => {
  const existing = await findRankAchievementSlabById(id);
  if (!existing) throw new AppError('Rank achievement slab not found', 404);
  await deleteRankAchievementSlabById(id);
  await logEvent({
    type: 'admin', action: 'ranks.achievementSlab.deleted', level: 'warn',
    message: `Rank achievement slab deleted (${existing.rank})`, actor: actorId, meta: { slabId: id },
  });
};

// Single bottom-up pass over the whole tree — see the plan's Design section for why
// depth-descending order makes this correct in one pass with no recursion.
export const recalculateAllRanks = async () => {
  const [users, unitRows, slabDocs] = await Promise.all([
    listAllUsersForRankRecalc(),
    sumActiveUnitsByUser(),
    listRankSlabs({ activeOnly: true }),
  ]);

  const selfUnitsByUser = new Map(unitRows.map((r) => [String(r._id), r.total]));
  // Highest rank first so the qualification walk below can take the first slab that passes.
  const slabsDesc = [...slabDocs].sort((a, b) => rankIndex(b.rank) - rankIndex(a.rank));

  const directsByParent = new Map();
  const stateByUser = new Map();
  for (const u of users) {
    const id = String(u._id);
    stateByUser.set(id, {
      rankIdx: rankIndex(u.rank?.current || RANKS.INVESTOR),
      highestIdx: rankIndex(u.rank?.highestAchieved || RANKS.INVESTOR),
      status: u.status,
      selfUnits: selfUnitsByUser.get(id) || 0,
    });
    if (u.sponsor) {
      const sponsorId = String(u.sponsor);
      if (!directsByParent.has(sponsorId)) directsByParent.set(sponsorId, []);
      directsByParent.get(sponsorId).push(id);
    }
  }

  // Deepest first — every direct referral of a user already has this run's fresh rank by
  // the time that user itself is evaluated.
  const sorted = [...users].sort((a, b) => (b.depth || 0) - (a.depth || 0));

  const achievementSlabDocs = await listRankAchievementSlabs({ activeOnly: true });
  const achievementByRank = new Map(achievementSlabDocs.map((s) => [s.rank, s]));

  const ops = [];
  const achievementCredits = []; // { userId, fromIdx, toIdx } — newly-crossed highest ranks this pass
  for (const u of sorted) {
    const id = String(u._id);
    const state = stateByUser.get(id);

    let newRankIdx = rankIndex(RANKS.INVESTOR);
    if (state.status === USER_STATUS.ACTIVE) {
      const directIds = directsByParent.get(id) || [];
      // Inactive directs count for nothing — not their own rank, not their sponsor's team.
      const activeDirects = directIds.filter((dId) => stateByUser.get(dId).status === USER_STATUS.ACTIVE);

      for (const slab of slabsDesc) {
        if (state.selfUnits < slab.selfUnitsMin) continue;
        const requiredIdx = rankIndex(slab.requiredDirectRank);
        const qualifyingDirects = activeDirects.filter((dId) => stateByUser.get(dId).rankIdx >= requiredIdx);
        if (qualifyingDirects.length < slab.directTeamSizeMin) continue;
        if (slab.teamBusinessUnitMin > 0) {
          const combinedUnits = qualifyingDirects.reduce((sum, dId) => sum + stateByUser.get(dId).selfUnits, 0);
          if (combinedUnits < slab.teamBusinessUnitMin) continue;
        }
        newRankIdx = rankIndex(slab.rank);
        break; // slabsDesc is highest-first, so the first pass found is the best rank
      }
    }

    const previousRank = u.rank?.current || RANKS.INVESTOR;
    const previousHighest = u.rank?.highestAchieved || RANKS.INVESTOR;
    const previousHighestIdx = rankIndex(previousHighest);

    state.rankIdx = newRankIdx;
    if (newRankIdx > state.highestIdx) state.highestIdx = newRankIdx;

    const currentRank = RANK_ORDER[newRankIdx];
    const highestRank = RANK_ORDER[state.highestIdx];

    if (currentRank !== previousRank || highestRank !== previousHighest) {
      const update = { $set: { 'rank.current': currentRank, 'rank.highestAchieved': highestRank } };
      if (currentRank !== previousRank) update.$set['rank.achievedAt'] = new Date();
      ops.push({ userId: u._id, update });
    }

    // A brand-new highest rank — rank.highestAchieved only ever moves forward, so this can
    // never re-fire for a rank this user already passed (even if they later demote and
    // re-climb back to it). No separate payout ledger needed; the User document itself is
    // the idempotency guard.
    if (state.highestIdx > previousHighestIdx) {
      achievementCredits.push({ userId: u._id, fromIdx: previousHighestIdx, toIdx: state.highestIdx });
    }
  }

  await bulkUpdateUserRanks(ops);

  let achievementBonusesPaid = 0;
  let achievementBonusTotal = 0;
  for (const { userId, fromIdx, toIdx } of achievementCredits) {
    for (let idx = fromIdx + 1; idx <= toIdx; idx++) {
      const slab = achievementByRank.get(RANK_ORDER[idx]);
      if (!slab?.amount) continue;
      try {
        await creditWallet({
          userId,
          walletType: WALLET_TYPES.REWARD,
          amount: slab.amount,
          source: RANK_ACHIEVEMENT_SOURCE,
          description: `Rank Achievement Bonus — ${RANK_ORDER[idx]}`,
        });
        await logEvent({
          type: 'bonus',
          action: 'bonus.rankAchievement.credited',
          message: `Rank Achievement Bonus of ${slab.amount} credited (${RANK_ORDER[idx]})`,
          user: userId,
          meta: { rank: RANK_ORDER[idx], amount: slab.amount },
        });
        achievementBonusesPaid += 1;
        achievementBonusTotal += slab.amount;
      } catch (err) {
        logger.error('ranks.achievementBonus.creditFailed', { userId: String(userId), rank: RANK_ORDER[idx], error: err.message });
      }
    }
  }

  return { scanned: users.length, changed: ops.length, achievementBonusesPaid, achievementBonusTotal };
};

// Read-only "my rank" status for a single user — current rank (as of the last
// recalculation) plus live progress toward the next attainable rank, computed the same
// way recalculateAllRanks evaluates a single node, just scoped to one user instead of the
// whole tree (cheap: one user + their direct referrals, not a full-platform scan).
export const getMyRankStatus = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found', 404);

  const currentRank = user.rank?.current || RANKS.INVESTOR;
  const highestAchieved = user.rank?.highestAchieved || RANKS.INVESTOR;
  const currentIdx = rankIndex(currentRank);

  const directIds = await findDirectReferralIds(userId);
  const [selfUnitsMap, directs] = await Promise.all([
    sumActiveUnitsForUsers([user._id, ...directIds]),
    listDirectReferralsBasic(directIds),
  ]);
  const selfUnits = selfUnitsMap.get(String(user._id)) || 0;

  const slabsAsc = [...(await listRankSlabs({ activeOnly: true }))].sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank));
  const nextSlab = slabsAsc.find((s) => rankIndex(s.rank) > currentIdx);

  if (!nextSlab) {
    return { currentRank, highestAchieved, selfUnits, nextRank: null };
  }

  const activeDirects = directs.filter((d) => d.status === USER_STATUS.ACTIVE);
  const requiredIdx = rankIndex(nextSlab.requiredDirectRank);
  const qualifyingDirects = activeDirects.filter((d) => rankIndex(d.rank?.current || RANKS.INVESTOR) >= requiredIdx);
  const directTeamSizeCurrent = qualifyingDirects.length;
  const teamBusinessUnitCurrent = qualifyingDirects.reduce((sum, d) => sum + (selfUnitsMap.get(String(d._id)) || 0), 0);

  const selfRatio = nextSlab.selfUnitsMin > 0 ? selfUnits / nextSlab.selfUnitsMin : 1;
  const teamRatio = nextSlab.directTeamSizeMin > 0 ? directTeamSizeCurrent / nextSlab.directTeamSizeMin : 1;
  const businessRatio = nextSlab.teamBusinessUnitMin > 0 ? teamBusinessUnitCurrent / nextSlab.teamBusinessUnitMin : 1;
  const progressPercent = Math.round(Math.max(0, Math.min(1, Math.min(selfRatio, teamRatio, businessRatio))) * 100);

  return {
    currentRank,
    highestAchieved,
    selfUnits,
    nextRank: {
      rank: nextSlab.rank,
      selfUnitsMin: nextSlab.selfUnitsMin,
      selfUnitsCurrent: selfUnits,
      directTeamSizeMin: nextSlab.directTeamSizeMin,
      directTeamSizeCurrent,
      requiredDirectRank: nextSlab.requiredDirectRank,
      teamBusinessUnitMin: nextSlab.teamBusinessUnitMin,
      teamBusinessUnitCurrent,
      progressPercent,
    },
  };
};

export const getSlabs = () => listRankSlabs();

export const createSlab = async (payload, actorId) => {
  const existing = await findRankSlabByRank(payload.rank);
  if (existing) throw new AppError(`A qualification slab for ${payload.rank} already exists`, 409);
  const slab = await createRankSlab(payload);
  await logEvent({
    type: 'admin', action: 'ranks.slab.created',
    message: `Rank qualification slab created (${payload.rank})`, actor: actorId, meta: { slabId: slab._id.toString(), payload },
  });
  return slab;
};

export const updateSlab = async (id, payload, actorId) => {
  const existing = await findRankSlabById(id);
  if (!existing) throw new AppError('Rank slab not found', 404);
  const slab = await updateRankSlabById(id, payload);
  await logEvent({
    type: 'admin', action: 'ranks.slab.updated',
    message: `Rank qualification slab updated (${existing.rank})`, actor: actorId, meta: { slabId: id, changes: payload },
  });
  return slab;
};

export const deleteSlab = async (id, actorId) => {
  const existing = await findRankSlabById(id);
  if (!existing) throw new AppError('Rank slab not found', 404);
  await deleteRankSlabById(id);
  await logEvent({
    type: 'admin', action: 'ranks.slab.deleted', level: 'warn',
    message: `Rank qualification slab deleted (${existing.rank})`, actor: actorId, meta: { slabId: id },
  });
};

// --- Rank Benefit Slabs (monthly perk bonuses) ---

export const getBenefitSlabs = () => listRankBenefitSlabs();

export const createBenefitSlab = async (payload, actorId) => {
  const existing = await findRankBenefitSlabByRank(payload.rank);
  if (existing) throw new AppError(`A benefit slab for ${payload.rank} already exists`, 409);
  const slab = await createRankBenefitSlab(payload);
  await logEvent({
    type: 'admin', action: 'ranks.benefitSlab.created',
    message: `Rank benefit slab created (${payload.rank})`, actor: actorId, meta: { slabId: slab._id.toString(), payload },
  });
  return slab;
};

export const updateBenefitSlab = async (id, payload, actorId) => {
  const existing = await findRankBenefitSlabById(id);
  if (!existing) throw new AppError('Rank benefit slab not found', 404);
  const slab = await updateRankBenefitSlabById(id, payload);
  await logEvent({
    type: 'admin', action: 'ranks.benefitSlab.updated',
    message: `Rank benefit slab updated (${existing.rank})`, actor: actorId, meta: { slabId: id, changes: payload },
  });
  return slab;
};

export const deleteBenefitSlab = async (id, actorId) => {
  const existing = await findRankBenefitSlabById(id);
  if (!existing) throw new AppError('Rank benefit slab not found', 404);
  await deleteRankBenefitSlabById(id);
  await logEvent({
    type: 'admin', action: 'ranks.benefitSlab.deleted', level: 'warn',
    message: `Rank benefit slab deleted (${existing.rank})`, actor: actorId, meta: { slabId: id },
  });
};

// Sums a user's direct/level-one team's investment units newly approved within a given
// calendar month — the "Direct Business (PM)" qualifying figure for rank benefits.
const directBusinessUnitsForMonth = async (userId, monthStart, monthEnd) => {
  const directIds = await findDirectReferralIds(userId);
  if (!directIds.length) return 0;
  return sumApprovedUnitsForUsersInWindow(directIds, monthStart, monthEnd);
};

// Monthly cron body — evaluates the calendar month that just closed for every active,
// ranked user: if their direct/level-one team's new business that month meets their
// current rank's qualifying threshold, credits every non-zero bonus for that rank into the
// Reward wallet and records one RankBenefitPayout row (also the idempotency guard, via its
// unique user+yearMonth index, so a rerun of this job is a no-op for months already paid).
export const evaluateMonthlyRankBenefits = async () => {
  const { start: monthStart, end: monthEnd, yearMonth } = getMonthRange(1);

  const [users, slabDocs] = await Promise.all([
    listActiveNonInvestorUsers(),
    listRankBenefitSlabs({ activeOnly: true }),
  ]);
  const slabByRank = new Map(slabDocs.map((s) => [s.rank, s]));

  let qualified = 0;
  let totalPaid = 0;

  for (const user of users) {
    const slab = slabByRank.get(user.rank?.current);
    if (!slab) continue;

    // Must have held this rank for the entire evaluated month, and not already paid for it.
    const achievedAt = user.rank?.achievedAt ? new Date(user.rank.achievedAt) : null;
    if (!achievedAt || achievedAt >= monthStart) continue;

    const alreadyPaid = await findRankBenefitPayout(user._id, yearMonth);
    if (alreadyPaid) continue;

    const directUnits = await directBusinessUnitsForMonth(user._id, monthStart, monthEnd);
    if (directUnits < slab.qualifyingDirectUnitsPerMonth) continue;

    const monthLabel = monthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const bonusesPaid = [];
    for (const { field, source, label } of BENEFIT_FIELDS) {
      const amount = slab[field];
      if (!amount || amount <= 0) continue;
      await creditWallet({
        userId: user._id,
        walletType: WALLET_TYPES.REWARD,
        amount,
        source,
        description: `${label} - ${slab.rank} - ${monthLabel}`,
      });
      bonusesPaid.push({ type: field, amount });
    }

    if (!bonusesPaid.length) continue;

    const total = bonusesPaid.reduce((sum, b) => sum + b.amount, 0);
    await createRankBenefitPayout({
      user: user._id,
      rank: slab.rank,
      yearMonth,
      directUnits,
      qualifyingUnitsRequired: slab.qualifyingDirectUnitsPerMonth,
      bonusesPaid,
      totalAmount: total,
    });

    qualified += 1;
    totalPaid += total;
  }

  return { yearMonth, scanned: users.length, qualified, totalPaid };
};

// Read-only "my rank benefits" card — current rank's benefit row (if any) plus this
// month's live progress toward the qualifying threshold, scoped to one user.
export const getMyRankBenefits = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new AppError('User not found', 404);

  const currentRank = user.rank?.current || RANKS.INVESTOR;
  const slab = currentRank === RANKS.INVESTOR ? null : await findRankBenefitSlabByRank(currentRank);

  const { start: monthStart, end: monthEnd } = getMonthRange(0);
  const directUnits = await directBusinessUnitsForMonth(user._id, monthStart, monthEnd);

  const achievedAt = user.rank?.achievedAt ? new Date(user.rank.achievedAt) : null;
  // This in-progress month only counts toward eligibility if the rank was already held
  // before it started — matches evaluateMonthlyRankBenefits' own gating.
  const monthCounts = !!achievedAt && achievedAt < monthStart;

  if (!slab) {
    return { currentRank, benefit: null, directUnits, qualifyingDirectUnitsPerMonth: 0, monthCounts };
  }

  const benefits = BENEFIT_FIELDS
    .filter(({ field }) => slab[field] > 0)
    .map(({ field, label }) => ({ type: field, label, amount: slab[field] }));

  return {
    currentRank,
    benefit: { rank: slab.rank, benefits, qualifyingDirectUnitsPerMonth: slab.qualifyingDirectUnitsPerMonth },
    directUnits,
    qualifyingDirectUnitsPerMonth: slab.qualifyingDirectUnitsPerMonth,
    monthCounts,
  };
};
