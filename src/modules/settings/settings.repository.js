import Settings from './settings.model.js';

// Get-or-create the single settings document.
export const getOrCreateSettings = () =>
  Settings.findOneAndUpdate({}, { $setOnInsert: {} }, { upsert: true, new: true, setDefaultsOnInsert: true });

export const updateSettings = async (update) => {
  await getOrCreateSettings();
  return Settings.findOneAndUpdate({}, update, { new: true, runValidators: true });
};
