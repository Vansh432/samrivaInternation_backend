import Investment from './investments.model.js';
import { INVESTMENT_STATUS } from '../../shared/constants/index.js';

export const createInvestment = (payload) => Investment.create(payload);

export const findInvestmentByCertificateNumber = (certificateNumber) =>
  Investment.findOne({ certificateNumber });

export const findInvestmentById = (id) => Investment.findById(id);

export const listInvestmentsByUser = (userId) =>
  Investment.find({ user: userId }).sort({ createdAt: -1 });

export const listActiveInvestmentsByUser = (userId) =>
  Investment.find({ user: userId, status: INVESTMENT_STATUS.ACTIVE }).sort({ maturityDate: 1 });

export const listInvestmentsByStatus = (status) =>
  Investment.find({ status }).populate('user', 'mobile fullName').sort({ createdAt: 1 });

// Admin "all investments" listing — filter/search handled by the caller (admin.service.js),
// this just applies the resulting Mongo filter with pagination.
export const listInvestmentsAdmin = ({ filter = {}, skip = 0, limit = 20 }) =>
  Investment.find(filter).populate('user', 'mobile fullName').sort({ createdAt: -1 }).skip(skip).limit(limit);

export const countInvestmentsAdmin = (filter = {}) => Investment.countDocuments(filter);

// A sponsor's referral code is only usable to bring in new team members once they've
// actually completed an investment (active or matured — not just submitted/pending, and
// not rejected/cancelled) — see auth.service.js#isSponsorEligible.
export const existsCompletedInvestmentForUser = (userId) =>
  Investment.exists({ user: userId, status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED] } });

// Bulk lookup for the Team/Genealogy views — one query for an entire downline's active
// units instead of one query per member.
export const listActiveInvestmentsForUsers = (userIds) =>
  Investment.find({ user: { $in: userIds }, status: INVESTMENT_STATUS.ACTIVE }, 'user units').lean();

// A user's own tenure clock only exists once they have an approved investment — this is
// that anchor date, used by the Fast Start Bonus to derive a sponsor's 30-day window
// without persisting it anywhere (see bonuses/bonuses.service.js#evaluateFastStartBonus).
export const findFirstApprovedInvestment = (userId) =>
  Investment.findOne({ user: userId, status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED] } }).sort({
    startDate: 1,
  });

// Sums approved units across a set of users within a date window — the Fast Start Bonus
// uses this to total a sponsor's direct team's units approved during the sponsor's window.
export const sumApprovedUnitsForUsersInWindow = async (userIds, windowStart, windowEnd) => {
  if (!userIds.length) return 0;
  const [result] = await Investment.aggregate([
    {
      $match: {
        user: { $in: userIds },
        status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED] },
        startDate: { $gte: windowStart, $lte: windowEnd },
      },
    },
    { $group: { _id: null, total: { $sum: '$units' } } },
  ]);
  return result?.total || 0;
};

// .lean() is safe here — the returns cron never mutates these directly, it issues its own
// atomic conditional updates (claimIncomeMonths/claimMaturity below) per investment.
export const listActiveInvestmentsForProcessing = () =>
  Investment.find({ status: INVESTMENT_STATUS.ACTIVE }).lean();

// Atomically advances incomeCreditedMonths only if it still matches `previousMonths` —
// returns null if another process already claimed this month's payout, so the caller
// never credits the wallet twice for the same month.
export const claimIncomeMonths = (investmentId, previousMonths, newMonths) =>
  Investment.findOneAndUpdate(
    { _id: investmentId, incomeCreditedMonths: previousMonths },
    { $set: { incomeCreditedMonths: newMonths } },
    { new: true }
  );

// Atomically flips active -> matured only once — returns null if already matured, so the
// maturity payout can never be credited twice even if the cron crashes mid-run and retries.
export const claimMaturity = (investmentId) =>
  Investment.findOneAndUpdate(
    { _id: investmentId, status: INVESTMENT_STATUS.ACTIVE },
    { $set: { status: INVESTMENT_STATUS.MATURED } },
    { new: true }
  );

// A user's matured investments not yet used for a renewal — what the "Renew Investment"
// picker on the mobile app shows.
export const listRenewableInvestmentsByUser = (userId) =>
  Investment.find({ user: userId, status: INVESTMENT_STATUS.MATURED, renewedInto: null }).sort({ maturityDate: -1 });

// Atomically claims a matured investment for renewal only once — guarded the same way as
// claimMaturity above, so a double-submit can never renew the same investment twice.
export const markInvestmentRenewed = (investmentId, newInvestmentId) =>
  Investment.findOneAndUpdate(
    { _id: investmentId, status: INVESTMENT_STATUS.MATURED, renewedInto: null },
    { $set: { renewedInto: newInvestmentId } },
    { new: true }
  );

// Lifetime sum of units across investments that originated from a renewal (renewedFrom
// set) for a set of users — the Retention Bonus's "direct team renewal units" figure.
export const sumRenewalUnitsForUsers = async (userIds) => {
  if (!userIds.length) return 0;
  const [result] = await Investment.aggregate([
    {
      $match: {
        user: { $in: userIds },
        renewedFrom: { $ne: null },
        status: { $in: [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED] },
      },
    },
    { $group: { _id: null, total: { $sum: '$units' } } },
  ]);
  return result?.total || 0;
};
