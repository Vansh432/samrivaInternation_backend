import { PLAN_TYPES, INVESTMENT_STATUS, WALLET_TYPES } from '../shared/constants/index.js';
import { calculateInvestmentReturns } from '../shared/utils/investmentReturns.js';
import { monthsElapsedBetween } from '../shared/utils/dateMath.js';
import { logEvent } from '../shared/utils/systemLog.js';
import {
  listActiveInvestmentsForProcessing,
  claimIncomeMonths,
  claimMaturity,
} from '../modules/investments/investments.repository.js';
import { creditWallet } from '../modules/wallets/wallets.service.js';
import { getOrCreateTdsConfig } from '../modules/wallets/wallets.repository.js';

const applyReturnTds = (grossReturn, user, tdsConfig) => {
  const tdsRate = user?.kyc?.pan ? tdsConfig.panRate : tdsConfig.noPanRate;
  const tdsAmount = grossReturn * (tdsRate / 100);
  return { tdsRate, tdsAmount, netReturn: grossReturn - tdsAmount };
};

// Monthly Income only — Compounding reinvests internally (calculateInvestmentReturns
// already reflects that at read time) and never touches the wallet until maturity.
const payMonthlyIncomeIfDue = async (investment, elapsed, tdsConfig) => {
  if (investment.planType !== PLAN_TYPES.MONTHLY_INCOME || elapsed <= investment.incomeCreditedMonths) {
    return false;
  }

  const previousMonths = investment.incomeCreditedMonths;
  const monthsToPay = elapsed - previousMonths;
  const grossReturn = investment.principal * (investment.ratePercent / 100) * monthsToPay;
  const { tdsRate, netReturn } = applyReturnTds(grossReturn, investment.user, tdsConfig);

  // Claim the months first — if this fails, another run already paid them; skip crediting.
  const claimed = await claimIncomeMonths(investment._id, previousMonths, elapsed);
  if (!claimed) return false;

  await creditWallet({
    userId: investment.user,
    walletType: WALLET_TYPES.MAIN,
    amount: netReturn,
    source: 'investment_monthly_income',
    referenceModel: 'Investment',
    referenceId: investment._id,
    description: `Monthly income for ${investment.certificateNumber} (month ${previousMonths + 1}-${elapsed}), TDS ${tdsRate}%`,
  });

  return true;
};

const payMaturityIfDue = async (investment, tdsConfig) => {
  if (new Date() < new Date(investment.maturityDate)) return false;

  // Claim maturity first (active -> matured) — if this fails, another run already
  // finalized it; skip crediting so the payout can never happen twice.
  const claimed = await claimMaturity(investment._id);
  if (!claimed) return false;

  const grossMaturityAmount =
    investment.planType === PLAN_TYPES.COMPOUNDING
      ? calculateInvestmentReturns({
          planType: investment.planType,
          principal: investment.principal,
          ratePercent: investment.ratePercent,
          months: investment.tenureMonths,
        }).currentValue
      : investment.principal; // monthly income already paid out incrementally — only principal returns
  const grossReturn = Math.max(grossMaturityAmount - investment.principal, 0);
  const { tdsRate, tdsAmount } = applyReturnTds(grossReturn, investment.user, tdsConfig);
  const maturityAmount = grossMaturityAmount - tdsAmount;

  await creditWallet({
    userId: investment.user,
    walletType: WALLET_TYPES.MAIN,
    amount: maturityAmount,
    source: 'investment_maturity',
    referenceModel: 'Investment',
    referenceId: investment._id,
    description: `Maturity payout for ${investment.certificateNumber}`,
  });

  await logEvent({
    type: 'investment',
    action: 'investment.matured',
    message: `Investment ${investment.certificateNumber} matured — ${maturityAmount} credited to main wallet after ${tdsRate}% TDS`,
    user: investment.user,
    meta: { investmentId: investment._id.toString(), grossMaturityAmount, tdsRate, tdsAmount, maturityAmount },
  });

  return true;
};

export const processInvestmentReturns = async () => {
  const investments = await listActiveInvestmentsForProcessing();
  const tdsConfig = await getOrCreateTdsConfig();
  let updated = 0;
  let failed = 0;

  for (const investment of investments) {
    try {
      const elapsed = monthsElapsedBetween(investment.startDate, investment.tenureMonths);
      const incomePaid = await payMonthlyIncomeIfDue(investment, elapsed, tdsConfig);
      const matured = await payMaturityIfDue(investment, tdsConfig);
      if (incomePaid || matured) updated++;
    } catch (err) {
      failed++;
      await logEvent({
        type: 'cron',
        action: 'investment.processFailed',
        level: 'error',
        message: `Failed to process investment ${investment.certificateNumber}: ${err.message}`,
        user: investment.user,
        meta: { investmentId: investment._id.toString() },
      });
    }
  }

  await logEvent({
    type: 'cron',
    action: 'investment.returnsProcessed',
    message: `Investment returns cron completed — ${updated} updated, ${failed} failed, ${investments.length} scanned`,
    meta: { updated, failed, scanned: investments.length },
  });

  return { updated, failed, scanned: investments.length };
};
