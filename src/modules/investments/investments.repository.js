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
