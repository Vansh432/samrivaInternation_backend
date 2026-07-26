import { PLAN_TYPES } from '../constants/index.js';

// Single source of truth for how an investment grows, month by month, so every caller
// (current-value display, maturity projection, future reports/statements) computes the
// exact same numbers instead of re-deriving the formula independently.
//
// Compounding: each month's interest is calculated on the *updated* balance (this
// month's principal + everything reinvested so far), then added back into the balance
// so the next month compounds on top of it.
//
// Monthly Income: each month's interest is calculated on the original principal only —
// the principal itself never grows, and nothing is reinvested.
export const calculateInvestmentReturns = ({ planType, principal, ratePercent, months }) => {
  const rate = ratePercent / 100;
  const monthsToCompute = Math.max(0, Math.floor(months));
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= monthsToCompute; month++) {
    let interest;
    if (planType === PLAN_TYPES.COMPOUNDING) {
      interest = balance * rate;
      balance += interest;
    } else {
      interest = principal * rate;
    }
    schedule.push({
      month,
      interest,
      balance: planType === PLAN_TYPES.COMPOUNDING ? balance : principal,
    });
  }

  const currentValue = planType === PLAN_TYPES.COMPOUNDING ? balance : principal;
  const roiEarned = schedule.reduce((sum, entry) => sum + entry.interest, 0);

  return { currentValue, roiEarned, schedule };
};
