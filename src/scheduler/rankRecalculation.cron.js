import { logEvent } from '../shared/utils/systemLog.js';
import { recalculateAllRanks } from '../modules/ranks/ranks.service.js';

export const processRankRecalculation = async () => {
  const result = await recalculateAllRanks();

  await logEvent({
    type: 'cron',
    action: 'ranks.recalculated',
    message: `Rank recalculation completed — ${result.changed} of ${result.scanned} users changed rank`,
    meta: result,
  });

  return result;
};
