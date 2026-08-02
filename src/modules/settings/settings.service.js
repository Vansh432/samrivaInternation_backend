import { logger } from '../../config/logger.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { getOrCreateSettings, updateSettings as updateSettingsRepo } from './settings.repository.js';

export const getSettings = () => getOrCreateSettings();

export const updateSettings = async (adminUser, payload) => {
  logger.info('settings.update.attempt', { adminId: adminUser._id.toString(), ...payload });
  const settings = await updateSettingsRepo(payload);
  logger.info('settings.update.success', { adminId: adminUser._id.toString() });
  await logEvent({
    type: 'admin', action: 'settings.updated',
    message: 'Platform settings updated', actor: adminUser._id, meta: { changes: payload },
  });
  return settings;
};
