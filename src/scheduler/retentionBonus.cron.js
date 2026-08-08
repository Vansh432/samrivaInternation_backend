import { evaluateMonthlyRetentionBonus } from '../modules/bonuses/bonuses.service.js';

// evaluateMonthlyRetentionBonus already logs its own 'cron'-type summary event internally —
// this wrapper just exists to match the other cron files' shape (a plain async function
// scheduler/index.js can register directly).
export const processRetentionBonus = () => evaluateMonthlyRetentionBonus();
