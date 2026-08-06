import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { getMonthRange } from '../../shared/utils/dateMath.js';
import { RANKS, USER_STATUS, WALLET_TYPES } from '../../shared/constants/index.js';
import { creditWallet } from '../wallets/wallets.service.js';
import { findUserById } from '../users/users.repository.js';
import { sumCommissionCreditsForUserInWindow } from '../wallets/walletTransactions.repository.js';
import {
  listOverrideSlabs,
  findOverrideSlabById,
  findOverrideSlabByGeneration,
  createOverrideSlab,
  updateOverrideSlabById,
  deleteOverrideSlabById,
  countOverrideSlabs,
  insertManyOverrideSlabs,
  listActiveUsersForOverrideSettlement,
  findOverridePayout,
  createOverridePayout,
} from './overrides.repository.js';

// investor..national_director, in hierarchy order — same concept as ranks.service.js's
// RANK_ORDER, re-derived here since that module doesn't export it.
const RANK_ORDER = Object.values(RANKS);
const rankIndex = (rank) => RANK_ORDER.indexOf(rank);

const DEFAULT_OVERRIDE_SLABS = [
  { generation: 1, percent: 2 },
  { generation: 2, percent: 1 },
  { generation: 3, percent: 0.5 },
];

export const ensureDefaultOverrideSlabs = async () => {
  const existing = await countOverrideSlabs();
  if (existing > 0) return;
  await insertManyOverrideSlabs(DEFAULT_OVERRIDE_SLABS);
  logger.info('overrides.defaultSlabs.seeded', { count: DEFAULT_OVERRIDE_SLABS.length });
};

// Monthly settlement — replaces the old per-investment trigger entirely. Runs via cron on
// the 1st of each month (scheduler/overrideSettlement.cron.js) and, under TESTING_MODE,
// inline on every /api/overrides hit (see middleware/testingAutoProcess.js). For every
// active user U, walks U's own ancestors (nearest-first, so ancestors[0]=Gen1=U's own
// sponsor, ancestors[1]=Gen2, ancestors[2]=Gen3) and pays U a % of that generation's
// person's OWN Commission wallet total for the month that just closed — but only if that
// generation's person is active and strictly outranks U. OverridePayout is both the
// idempotency guard (unique user+generation+yearMonth) and the audit trail, so re-running
// this (including repeated TESTING_MODE triggers) can never double-pay the same month twice.
export const settleLeadershipOverrides = async ({ userIds } = {}) => {
  const { start, end, yearMonth } = getMonthRange(1); // the calendar month that just closed
  const slabs = await listOverrideSlabs({ activeOnly: true });
  if (!slabs.length) return { yearMonth, evaluated: 0, paid: 0, totalPaid: 0 };

  const slabByGeneration = new Map(slabs.map((s) => [s.generation, s]));
  const users = await listActiveUsersForOverrideSettlement({ userIds });
  const byId = new Map(users.map((u) => [String(u._id), u]));

  let evaluated = 0;
  let paid = 0;
  let totalPaid = 0;

  for (const user of users) {
    const userRankIdx = rankIndex(user.rank?.current || RANKS.INVESTOR);
    const ancestorIds = user.ancestors || []; // nearest-first: [0]=Gen1, [1]=Gen2, [2]=Gen3

    for (let generation = 1; generation <= 3; generation++) {
      const slab = slabByGeneration.get(generation);
      const ancestorId = ancestorIds[generation - 1];
      if (!slab || !ancestorId) continue;
      evaluated += 1;

      try {
        const already = await findOverridePayout(user._id, generation, yearMonth);
        if (already) continue; // already settled this (user, generation, month)

        const ancestor = byId.get(String(ancestorId)) || (await findUserById(ancestorId));
        if (!ancestor || ancestor.status !== USER_STATUS.ACTIVE) continue;

        const ancestorRankIdx = rankIndex(ancestor.rank?.current || RANKS.INVESTOR);
        if (ancestorRankIdx <= userRankIdx) continue; // must strictly outrank the receiving user

        const commissionBase = await sumCommissionCreditsForUserInWindow(ancestorId, start, end);
        const amount = commissionBase * (slab.percent / 100);
        if (amount <= 0) continue; // nothing to pay — safe to re-check next run, no payout row needed

        await creditWallet({
          userId: user._id,
          walletType: WALLET_TYPES.BONUS,
          amount,
          source: `leadership_override_gen${generation}`,
          description: `Leadership Override — Gen ${generation} (${slab.percent}% of ${yearMonth} commission)`,
        });

        await createOverridePayout({
          user: user._id, generation, sourceUser: ancestorId, yearMonth,
          percent: slab.percent, commissionBase, amount,
        });

        await logEvent({
          type: 'bonus',
          action: 'bonus.leadershipOverride.credited',
          message: `Leadership Override (Gen ${generation}) of ${amount} credited for ${yearMonth}`,
          user: user._id,
          meta: { generation, percent: slab.percent, commissionBase, amount, yearMonth, sourceUserId: String(ancestorId) },
        });

        paid += 1;
        totalPaid += amount;
      } catch (err) {
        logger.error('overrides.leadershipSettlement.failed', {
          userId: user._id.toString(), generation, error: err.message,
        });
      }
    }
  }

  await logEvent({
    type: 'cron',
    action: 'overrides.leadershipSettled',
    message: `Leadership Override settlement for ${yearMonth} completed — ${paid} of ${evaluated} generation-slots paid, ₹${totalPaid} total`,
    meta: { yearMonth, evaluated, paid, totalPaid },
  });

  return { yearMonth, evaluated, paid, totalPaid };
};

export const getOverrideSlabs = () => listOverrideSlabs();

export const createSlab = async (payload, actorId) => {
  const existing = await findOverrideSlabByGeneration(payload.generation);
  if (existing) throw new AppError(`A slab for generation ${payload.generation} already exists`, 409);
  const slab = await createOverrideSlab(payload);
  await logEvent({
    type: 'admin', action: 'overrides.slab.created',
    message: `Leadership Override slab created (Gen ${payload.generation})`, actor: actorId, meta: { slabId: slab._id.toString(), payload },
  });
  return slab;
};

export const updateSlab = async (id, payload, actorId) => {
  const existing = await findOverrideSlabById(id);
  if (!existing) throw new AppError('Leadership Override slab not found', 404);
  if (payload.generation !== undefined && payload.generation !== existing.generation) {
    const clashing = await findOverrideSlabByGeneration(payload.generation);
    if (clashing) throw new AppError(`A slab for generation ${payload.generation} already exists`, 409);
  }
  const slab = await updateOverrideSlabById(id, payload);
  await logEvent({
    type: 'admin', action: 'overrides.slab.updated',
    message: `Leadership Override slab updated (Gen ${existing.generation})`, actor: actorId, meta: { slabId: id, changes: payload },
  });
  return slab;
};

export const deleteSlab = async (id, actorId) => {
  const existing = await findOverrideSlabById(id);
  if (!existing) throw new AppError('Leadership Override slab not found', 404);
  await deleteOverrideSlabById(id);
  await logEvent({
    type: 'admin', action: 'overrides.slab.deleted', level: 'warn',
    message: `Leadership Override slab deleted (Gen ${existing.generation})`, actor: actorId, meta: { slabId: id },
  });
};
