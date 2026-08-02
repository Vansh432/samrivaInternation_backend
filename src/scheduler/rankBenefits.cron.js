import { logEvent } from '../shared/utils/systemLog.js';
import { evaluateMonthlyRankBenefits } from '../modules/ranks/ranks.service.js';

export const processRankBenefits = async () => {
  const result = await evaluateMonthlyRankBenefits();

  await logEvent({
    type: 'cron',
    action: 'ranks.benefitsEvaluated',
    message: `Rank benefit evaluation for ${result.yearMonth} completed — ${result.qualified} of ${result.scanned} users qualified, ₹${result.totalPaid} paid`,
    meta: result,
  });

  return result;
};
