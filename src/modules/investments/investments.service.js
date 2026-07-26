import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { generateCertificateNumber } from '../../shared/utils/certificateNumber.js';
import { PLAN_TYPES, KYC_STATUS } from '../../shared/constants/index.js';
import { resolveRate } from '../plans/plans.service.js';
import { getSettings } from '../settings/settings.service.js';
import {
  createInvestment,
  findInvestmentByCertificateNumber,
  findInvestmentById,
  listInvestmentsByUser,
  listActiveInvestmentsByUser,
} from './investments.repository.js';

const buildUniqueCertificateNumber = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCertificateNumber();
    const existing = await findInvestmentByCertificateNumber(code);
    if (!existing) return code;
  }
  throw new AppError('Could not generate a unique certificate number, please try again', 500);
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const monthsElapsed = (startDate, tenureMonths) => {
  const now = new Date();
  const msElapsed = now.getTime() - new Date(startDate).getTime();
  const monthsFloat = msElapsed / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(0, Math.min(tenureMonths, Math.floor(monthsFloat)));
};

// Compounding: reinvested monthly, grows to principal * (1+r)^t, gains realized at maturity.
// Monthly Income: fixed payout each month, principal itself never grows — it's returned at maturity.
const computeDerivedFields = (inv) => {
  const rate = inv.ratePercent / 100;
  const elapsed = monthsElapsed(inv.startDate, inv.tenureMonths);
  let currentValue;
  let roiEarned;
  if (inv.planType === PLAN_TYPES.COMPOUNDING) {
    currentValue = inv.principal * Math.pow(1 + rate, elapsed);
    roiEarned = currentValue - inv.principal;
  } else {
    currentValue = inv.principal;
    roiEarned = inv.principal * rate * elapsed;
  }
  return { currentValue, roiEarned, monthsElapsed: elapsed };
};

const toInvestmentJSON = (inv) => ({ ...inv.toJSON(), ...computeDerivedFields(inv) });

export const createUserInvestment = async (user, { planType, units, tenureMonths, paymentMode }) => {
  logger.info('investments.create.attempt', { userId: user._id.toString(), planType, units, tenureMonths });

  if (user.kyc.status !== KYC_STATUS.APPROVED) {
    logger.warn('investments.create.kycNotApproved', { userId: user._id.toString(), kycStatus: user.kyc.status });
    throw new AppError('Your KYC must be approved before you can invest', 403);
  }

  const { ratePercent } = await resolveRate({ planType, units, tenureMonths });
  const settings = await getSettings();
  const unitValueInr = settings.unitValueInr;
  const principal = units * unitValueInr;
  const certificateNumber = await buildUniqueCertificateNumber();
  const startDate = new Date();
  const maturityDate = addMonths(startDate, tenureMonths);

  const investment = await createInvestment({
    user: user._id,
    planType,
    units,
    tenureMonths,
    unitValueInr,
    principal,
    ratePercent,
    paymentMode,
    certificateNumber,
    startDate,
    maturityDate,
  });

  logger.info('investments.create.success', { userId: user._id.toString(), investmentId: investment._id.toString() });
  return toInvestmentJSON(investment);
};

export const getUserInvestments = async (userId) => {
  const investments = await listInvestmentsByUser(userId);
  return investments.map(toInvestmentJSON);
};

export const getUserInvestmentById = async (userId, investmentId) => {
  const investment = await findInvestmentById(investmentId);
  if (!investment || investment.user.toString() !== userId.toString()) {
    throw new AppError('Investment not found', 404);
  }
  return toInvestmentJSON(investment);
};

export const getUserInvestmentSummary = async (userId) => {
  const investments = await listInvestmentsByUser(userId);
  const enriched = investments.map((inv) => ({ raw: inv, ...computeDerivedFields(inv) }));

  const totalInvestment = investments.reduce((sum, inv) => sum + inv.principal, 0);
  const activeUnits = investments.filter((inv) => inv.status === 'active').reduce((sum, inv) => sum + inv.units, 0);
  const maturedUnits = investments.filter((inv) => inv.status === 'matured').reduce((sum, inv) => sum + inv.units, 0);
  const portfolioValue = enriched.reduce((sum, e) => sum + e.currentValue, 0);
  const monthlyIncome = investments
    .filter((inv) => inv.status === 'active' && inv.planType === PLAN_TYPES.MONTHLY_INCOME)
    .reduce((sum, inv) => sum + inv.principal * (inv.ratePercent / 100), 0);

  const upcomingMaturity = (await listActiveInvestmentsByUser(userId)).slice(0, 3).map((inv) => ({
    id: inv._id.toString(),
    certificateNumber: inv.certificateNumber,
    units: inv.units,
    planType: inv.planType,
    maturityDate: inv.maturityDate,
    principal: inv.principal,
  }));

  return {
    totalInvestment,
    activeUnits,
    maturedUnits,
    portfolioValue,
    monthlyIncome,
    availableWithdrawals: 0,
    upcomingMaturity,
  };
};
