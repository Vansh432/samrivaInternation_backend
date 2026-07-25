import User from './users.model.js';

export const findUserByMobile = (mobile, { withPassword = false } = {}) => {
  const query = User.findOne({ mobile });
  return withPassword ? query.select('+password') : query;
};

export const findUserById = (id) => User.findById(id);

export const findUserByReferralCode = (referralCode) => User.findOne({ referralCode });

export const createUser = (payload) => User.create(payload);

export const updateUserById = (id, update) =>
  User.findByIdAndUpdate(id, update, { new: true, runValidators: true });

export const incrementTokenVersion = (id) =>
  User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true });
