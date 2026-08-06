import { settlePendingCommission } from '../modules/wallets/wallets.service.js';

// settlePendingCommission already logs its own 'cron'-type summary event internally (only
// when today is actually a configured closing day) — this wrapper just exists to match the
// other cron files' shape (a plain async function scheduler/index.js can register directly).
export const processCommissionSettlement = () => settlePendingCommission();
