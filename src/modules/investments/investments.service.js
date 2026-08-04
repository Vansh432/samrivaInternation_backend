import mongoose from 'mongoose';
import { AppError } from '../../shared/errors/AppError.js';
import { generateCertificateNumber } from '../../shared/utils/certificateNumber.js';
import { calculateInvestmentReturns } from '../../shared/utils/investmentReturns.js';
import { addMonths, monthsElapsedBetween } from '../../shared/utils/dateMath.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { PLAN_TYPES, KYC_STATUS, ROLES, INVESTMENT_STATUS, PAYMENT_MODES, WALLET_TYPES, WALLET_TXN_TYPES } from '../../shared/constants/index.js';
import { resolveRate } from '../plans/plans.service.js';
import { getSettings } from '../settings/settings.service.js';
import { getNextSequenceRange, padSequence } from '../../shared/utils/sequence.js';
import { decrementWalletBalanceIfSufficient } from '../wallets/wallets.repository.js';
import { createWalletTransaction } from '../wallets/walletTransactions.repository.js';
import {
  createInvestment,
  findInvestmentByCertificateNumber,
  findInvestmentById,
  listInvestmentsByUser,
  listActiveInvestmentsByUser,
  listRenewableInvestmentsByUser,
  markInvestmentRenewed,
} from './investments.repository.js';
import { generateInvestmentCertificate } from '../certificates/certificate.service.js';
import { evaluateRetentionBonus } from '../bonuses/bonuses.service.js';

const buildUniqueCertificateNumber = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCertificateNumber();
    const existing = await findInvestmentByCertificateNumber(code);
    if (!existing) return code;
  }
  throw new AppError('Could not generate a unique certificate number, please try again', 500);
};

const ACCRUING_STATUSES = [INVESTMENT_STATUS.ACTIVE, INVESTMENT_STATUS.MATURED];

// Only investments whose tenure has actually started (active/matured) accrue anything —
// pending_verification/rejected investments have no startDate yet and show flat at principal.
const computeDerivedFields = (inv) => {
  const elapsed = ACCRUING_STATUSES.includes(inv.status)
    ? monthsElapsedBetween(inv.startDate, inv.tenureMonths)
    : 0;
  const { currentValue, roiEarned } = calculateInvestmentReturns({
    planType: inv.planType,
    principal: inv.principal,
    ratePercent: inv.ratePercent,
    months: elapsed,
  });
  const monthlyIncome = inv.principal * (inv.ratePercent / 100);
  // Total payout at the end of the full tenure — principal plus everything earned over
  // all months (not just elapsed), so the UI can show the guaranteed end value upfront.
  const { roiEarned: totalRoiAtMaturity } = calculateInvestmentReturns({
    planType: inv.planType,
    principal: inv.principal,
    ratePercent: inv.ratePercent,
    months: inv.tenureMonths,
  });
  const maturityAmount = inv.principal + totalRoiAtMaturity;
  return { currentValue, roiEarned, monthsElapsed: elapsed, monthlyIncome, maturityAmount };
};

const toInvestmentJSON = (inv) => ({ ...inv.toJSON(), ...computeDerivedFields(inv) });

// Staff-only accounts (employee/admin/super_admin) are operational logins, not customer
// accounts — they must never be able to hold an investment themselves.
const INVESTMENT_ELIGIBLE_ROLES = [ROLES.INVESTOR, ROLES.WEALTH_PARTNER, ROLES.FRANCHISE];

export const createUserInvestment = async (user, { planType, units, tenureMonths, paymentMode, amountPaid, transactionId, paymentProofUrl }) => {
  if (!INVESTMENT_ELIGIBLE_ROLES.includes(user.role)) {
    logEvent({
      type: 'investment', action: 'investment.roleNotEligible', level: 'warn',
      message: 'Investment attempt blocked — ineligible role', user: user._id, meta: { role: user.role },
    });
    throw new AppError('Your account type is not eligible to invest', 403);
  }

  // Note: account-active status is already enforced globally by the `protect` middleware
  // before a request ever reaches here — no need to re-check it in this service.
  // TESTING MODE ONLY — see env.js#testingMode. Remove this `!env.testingMode &&` to restore
  // the real KYC gate.
  if (!env.testingMode && user.kyc.status !== KYC_STATUS.APPROVED) {
    logEvent({
      type: 'investment', action: 'investment.kycNotApproved', level: 'warn',
      message: 'Investment attempt blocked — KYC not approved', user: user._id, meta: { kycStatus: user.kyc.status },
    });
    throw new AppError('Your KYC must be approved before you can invest', 403);
  }

  const { ratePercent, minUnits, maxUnits } = await resolveRate({ planType, units, tenureMonths });
  const settings = await getSettings();
  const unitValueInr = settings.unitValueInr;
  const principal = units * unitValueInr;
  const certificateNumber = await buildUniqueCertificateNumber();

  // Deliberately no startDate/maturityDate yet — the tenure clock only starts once an
  // admin verifies the submitted payment (see admin.service.js#approveInvestment).
  const investment = await createInvestment({
    user: user._id,
    planType,
    units,
    tenureMonths,
    unitValueInr,
    principal,
    ratePercent,
    unitRangeMin: minUnits,
    unitRangeMax: maxUnits,
    paymentMode,
    amountPaid,
    transactionId,
    paymentProofUrl,
    certificateNumber,
    status: INVESTMENT_STATUS.PENDING_VERIFICATION,
  });

  await logEvent({
    type: 'investment', action: 'investment.submitted',
    message: `Investment submitted for admin verification (${certificateNumber})`,
    user: user._id, meta: { investmentId: investment._id.toString(), planType, units, tenureMonths, principal },
  });

  return toInvestmentJSON(investment);
};

// A user's matured, not-yet-renewed investments — what the "Renew Investment" picker shows.
export const getRenewableInvestments = async (userId) => {
  const investments = await listRenewableInvestmentsByUser(userId);
  return investments.map(toInvestmentJSON);
};

// Reinvests a matured investment's payout into a brand-new one, funded by debiting the
// Main wallet instead of a bank-proof transaction. Skips PENDING_VERIFICATION entirely and
// activates immediately — the funds being moved are already verified on-platform money,
// unlike an external bank transfer that genuinely needs admin review.
export const createRenewalInvestment = async (user, { fromInvestmentId, planType, units, tenureMonths }) => {
  if (!INVESTMENT_ELIGIBLE_ROLES.includes(user.role)) {
    throw new AppError('Your account type is not eligible to invest', 403);
  }
  // TESTING MODE ONLY — see env.js#testingMode. Remove this `!env.testingMode &&` to restore
  // the real KYC gate.
  if (!env.testingMode && user.kyc.status !== KYC_STATUS.APPROVED) {
    throw new AppError('Your KYC must be approved before you can invest', 403);
  }

  const fromInvestment = await findInvestmentById(fromInvestmentId);
  if (!fromInvestment || fromInvestment.user.toString() !== user._id.toString()) {
    throw new AppError('Investment not found', 404);
  }
  if (fromInvestment.status !== INVESTMENT_STATUS.MATURED) {
    throw new AppError('Only a matured investment can be renewed', 400);
  }
  if (fromInvestment.renewedInto) {
    throw new AppError('This investment has already been renewed', 400);
  }

  const { ratePercent, minUnits, maxUnits } = await resolveRate({ planType, units, tenureMonths });
  const settings = await getSettings();
  const unitValueInr = settings.unitValueInr;
  const principal = units * unitValueInr;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const debited = await decrementWalletBalanceIfSufficient(user._id, WALLET_TYPES.MAIN, principal, session);
      if (!debited) throw new AppError('Insufficient Main wallet balance for this renewal', 400);

      await createWalletTransaction(
        {
          user: user._id,
          walletType: WALLET_TYPES.MAIN,
          type: WALLET_TXN_TYPES.DEBIT,
          amount: principal,
          balanceAfter: debited.balances.main,
          source: 'investment_renewal',
          referenceModel: 'Investment',
          referenceId: fromInvestment._id,
          description: `Renewed into a new ${units}-unit investment`,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  const certificateNumber = await buildUniqueCertificateNumber();
  const startDate = new Date();

  const newInvestment = await createInvestment({
    user: user._id,
    planType,
    units,
    tenureMonths,
    unitValueInr,
    principal,
    ratePercent,
    unitRangeMin: minUnits,
    unitRangeMax: maxUnits,
    paymentMode: PAYMENT_MODES.WALLET_RENEWAL,
    amountPaid: principal,
    transactionId: `RENEWAL-${fromInvestment.certificateNumber}`,
    certificateNumber,
    status: INVESTMENT_STATUS.ACTIVE,
    startDate,
    maturityDate: addMonths(startDate, tenureMonths),
    dateOfAllotment: startDate,
    redemptionDate: addMonths(startDate, tenureMonths),
    renewedFrom: fromInvestment._id,
  });

  const { start, end } = await getNextSequenceRange('debentureNo', units);
  newInvestment.debentureNoStart = `D${padSequence(start)}`;
  newInvestment.debentureNoEnd = `D${padSequence(end)}`;

  try {
    const relativePath = await generateInvestmentCertificate(newInvestment, user);
    newInvestment.certificatePdfUrl = relativePath;
  } catch (err) {
    logger.error('investments.createRenewalInvestment.certificateGenerationFailed', { investmentId: newInvestment._id.toString(), error: err.message });
  }

  await newInvestment.save();
  await markInvestmentRenewed(fromInvestment._id, newInvestment._id);

  // Best-effort, same as certificate generation above — a Retention Bonus evaluation bug
  // must never block the renewal itself, which is the part that matters financially first.
  try {
    await evaluateRetentionBonus(newInvestment);
  } catch (err) {
    logger.error('investments.createRenewalInvestment.retentionBonusFailed', { investmentId: newInvestment._id.toString(), error: err.message });
  }

  await logEvent({
    type: 'investment',
    action: 'investment.renewed',
    message: `Investment ${fromInvestment.certificateNumber} renewed into ${newInvestment.certificateNumber}`,
    user: user._id,
    meta: { fromInvestmentId: fromInvestment._id.toString(), newInvestmentId: newInvestment._id.toString(), principal },
  });

  return toInvestmentJSON(newInvestment);
};

// Preview-only projection for the "review before you invest" screen — mirrors the same
// resolveRate + settings lookup createUserInvestment uses, so the numbers shown to the
// user are guaranteed to match what actually gets locked in when they submit.
export const getInvestmentQuote = async ({ planType, units, tenureMonths }) => {
  const { ratePercent } = await resolveRate({ planType, units, tenureMonths });
  const settings = await getSettings();
  const unitValueInr = settings.unitValueInr;
  const principal = units * unitValueInr;
  const estMonthlyIncome = principal * (ratePercent / 100);
  // "At maturity" is the total wealth out — principal plus everything earned over the
  // full tenure. For compounding that's the same as currentValue; for monthly income,
  // currentValue alone is just the untouched principal, so payouts must be added back.
  const { roiEarned: totalRoiAtMaturity } = calculateInvestmentReturns({
    planType,
    principal,
    ratePercent,
    months: tenureMonths,
  });
  const maturityValue = principal + totalRoiAtMaturity;

  return {
    planType,
    units,
    tenureMonths,
    unitValueInr,
    ratePercent,
    principal,
    estMonthlyIncome,
    maturityValue,
  };
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

  // Pending-verification investments aren't real yet (admin hasn't confirmed the payment) —
  // only accruing (active/matured) investments count toward the portfolio totals, otherwise
  // the aggregate would show money the individual investment cards mark as "unverified".
  const totalInvestment = investments
    .filter((inv) => ACCRUING_STATUSES.includes(inv.status))
    .reduce((sum, inv) => sum + inv.principal, 0);
  const activeUnits = investments.filter((inv) => inv.status === INVESTMENT_STATUS.ACTIVE).reduce((sum, inv) => sum + inv.units, 0);
  const maturedUnits = investments.filter((inv) => inv.status === INVESTMENT_STATUS.MATURED).reduce((sum, inv) => sum + inv.units, 0);
  // principal + roiEarned, not currentValue — for compounding these are the same (interest
  // is reinvested into currentValue), but for monthly income currentValue stays pinned at
  // principal (the interest is paid out, not reinvested), so it must be added back here so
  // Portfolio Value always reflects total investment + interest earned across all plans.
  const portfolioValue = enriched
    .filter((e) => ACCRUING_STATUSES.includes(e.raw.status))
    .reduce((sum, e) => sum + e.raw.principal + e.roiEarned, 0);
  const monthlyIncome = investments
    .filter((inv) => inv.status === INVESTMENT_STATUS.ACTIVE && inv.planType === PLAN_TYPES.MONTHLY_INCOME)
    .reduce((sum, inv) => sum + inv.principal * (inv.ratePercent / 100), 0);

  // Same accruing-only enriched set, split by plan type — lets the UI show Compounding and
  // Monthly Income as two separate mini-dashboards instead of one blended total.
  const accruingEnriched = enriched.filter((e) => ACCRUING_STATUSES.includes(e.raw.status));
  const compoundingEnriched = accruingEnriched.filter((e) => e.raw.planType === PLAN_TYPES.COMPOUNDING);
  const monthlyIncomeEnriched = accruingEnriched.filter((e) => e.raw.planType === PLAN_TYPES.MONTHLY_INCOME);

  const byPlanType = {
    compounding: {
      totalInvested: compoundingEnriched.reduce((sum, e) => sum + e.raw.principal, 0),
      totalMaturityValue: compoundingEnriched.reduce((sum, e) => sum + e.maturityAmount, 0),
    },
    monthlyIncome: {
      totalInvested: monthlyIncomeEnriched.reduce((sum, e) => sum + e.raw.principal, 0),
      // Only ACTIVE (not matured) investments still pay out monthly — same scope as the
      // top-level `monthlyIncome` field above.
      totalMonthlyIncome: monthlyIncomeEnriched
        .filter((e) => e.raw.status === INVESTMENT_STATUS.ACTIVE)
        .reduce((sum, e) => sum + e.raw.principal * (e.raw.ratePercent / 100), 0),
      totalMaturityValue: monthlyIncomeEnriched.reduce((sum, e) => sum + e.maturityAmount, 0),
    },
  };

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
    byPlanType,
    availableWithdrawals: 0,
    upcomingMaturity,
  };
};

// Re-exported so admin.service.js (approve/reject) and the returns cron can compute the
// same numbers this module uses, without duplicating the formulas.
export { addMonths, monthsElapsedBetween, computeDerivedFields, toInvestmentJSON };
