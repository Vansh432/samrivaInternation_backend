import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { RANKS, USER_STATUS, WALLET_TYPES } from '../../shared/constants/index.js';
import { creditWallet } from '../wallets/wallets.service.js';
import { findUserById } from '../users/users.repository.js';
import {
  listOverrideSlabs,
  findOverrideSlabById,
  findOverrideSlabByGeneration,
  createOverrideSlab,
  updateOverrideSlabById,
  deleteOverrideSlabById,
  countOverrideSlabs,
  insertManyOverrideSlabs,
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

// Called right after an investment is approved (see admin.service.js#approveInvestment),
// same best-effort try/catch, same single trigger point as evaluateFastStartBonus — an
// investment can only transition pending_verification -> active once, so this can never
// double-pay without needing its own idempotency flags.
export const evaluateLeadershipOverride = async (investment) => {
  const investor = await findUserById(investment.user);
  if (!investor?.sponsor) return;

  const sponsor = await findUserById(investor.sponsor);
  if (!sponsor) return;

  const slabs = await listOverrideSlabs({ activeOnly: true });
  if (!slabs.length) return;

  const slabByGeneration = new Map(slabs.map((s) => [s.generation, s]));
  const sponsorRankIdx = rankIndex(sponsor.rank?.current || RANKS.INVESTOR);
  const ancestorIds = sponsor.ancestors || []; // nearest-first: [0]=gen1, [1]=gen2, [2]=gen3

  for (let generation = 1; generation <= 3; generation++) {
    const slab = slabByGeneration.get(generation);
    const ancestorId = ancestorIds[generation - 1];
    if (!slab || !ancestorId) continue;

    const leader = await findUserById(ancestorId);
    if (!leader || leader.status !== USER_STATUS.ACTIVE) continue;

    const leaderRankIdx = rankIndex(leader.rank?.current || RANKS.INVESTOR);
    if (leaderRankIdx <= sponsorRankIdx) continue; // must strictly outrank the sponsor

    const amount = investment.principal * (slab.percent / 100);
    if (amount <= 0) continue;

    await creditWallet({
      userId: leader._id,
      walletType: WALLET_TYPES.BONUS,
      amount,
      source: `leadership_override_gen${generation}`,
      referenceModel: 'Investment',
      referenceId: investment._id,
      description: `Leadership Override — Gen ${generation} (${slab.percent}% of ${investment.certificateNumber})`,
    });

    await logEvent({
      type: 'bonus',
      action: 'bonus.leadershipOverride.credited',
      message: `Leadership Override (Gen ${generation}) of ${amount} credited`,
      user: leader._id,
      meta: { generation, percent: slab.percent, amount, investmentId: investment._id.toString(), sponsorId: sponsor._id.toString() },
    });
  }
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
