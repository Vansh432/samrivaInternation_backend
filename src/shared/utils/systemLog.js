import Log from '../../database/models/log.model.js';
import { logger } from '../../config/logger.js';

// Single reusable entry point for structured, DB-persisted event logging — usable by any
// module. Writes both the queryable Log document and the existing winston file logger, so
// nothing about current logging behavior changes; this just adds a queryable copy.
export const logEvent = async ({ type, action, level = 'info', message, meta, user, actor }) => {
  logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](action, { message, ...meta });
  try {
    await Log.create({ type, action, level, message, meta, user, actor });
  } catch (err) {
    // Logging must never break the calling operation — fall back to the file logger only.
    logger.error('systemLog.persistFailed', { action, error: err.message });
  }
};

// Admin "Activity Logs" listing — filter/paginate/populate shape mirrors
// walletTransactions.repository.js#listWalletTransactionsAdmin.
export const listLogsAdmin = ({ filter = {}, skip = 0, limit = 20 }) =>
  Log.find(filter)
    .populate('user', 'mobile fullName')
    .populate('actor', 'mobile fullName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

export const countLogs = (filter = {}) => Log.countDocuments(filter);
