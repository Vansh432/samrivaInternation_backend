import { logger } from '../../config/logger.js';
import { logEvent } from '../../shared/utils/systemLog.js';
import { KYC_STATUS } from '../../shared/constants/index.js';
import { AppError } from '../../shared/errors/AppError.js';
import { findUserById, updateUserById } from './users.repository.js';

export const updateProfile = async (userId, { fullName, fatherOrHusbandName, email, dob, address }) => {
  logger.info('users.updateProfile.attempt', { userId: userId.toString() });

  const update = {};
  if (fullName !== undefined) update.fullName = fullName;
  if (fatherOrHusbandName !== undefined) update.fatherOrHusbandName = fatherOrHusbandName;
  if (email !== undefined) update.email = email;
  if (dob !== undefined) update.dob = dob;
  if (address !== undefined) {
    update.address = {
      line1: address.line1,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    };
  }

  const user = await updateUserById(userId, update);
  logger.info('users.updateProfile.success', { userId: userId.toString() });
  await logEvent({
    type: 'user', action: 'user.profileUpdated',
    message: 'Profile updated', user: userId, meta: { fields: Object.keys(update) },
  });
  return user;
};

export const submitKyc = async (userId, { pan, aadhaar, bank, nominee, addressProofUrl, selfieUrl }) => {
  logger.info('users.submitKyc.attempt', { userId: userId.toString() });

  // Once a submission is in front of an admin (or already approved), the investor cannot
  // edit or resubmit — only a rejection/hold from admin re-opens this for them.
  const existing = await findUserById(userId);
  if (!existing) throw new AppError('User not found', 404);
  if (existing.kyc.status === KYC_STATUS.SUBMITTED) {
    throw new AppError('KYC is already submitted and awaiting review', 400);
  }
  if (existing.kyc.status === KYC_STATUS.APPROVED) {
    throw new AppError('KYC is already approved and cannot be resubmitted', 400);
  }

  const update = {
    kyc: {
      status: KYC_STATUS.SUBMITTED,
      pan,
      aadhaar,
      bank,
      nominee,
      addressProofUrl,
      selfieUrl,
      termsAcceptedAt: new Date(),
      submittedAt: new Date(),
    },
  };

  const user = await updateUserById(userId, update);
  logger.info('users.submitKyc.success', { userId: userId.toString() });
  await logEvent({
    type: 'user', action: 'user.kycSubmitted',
    message: 'KYC submitted for review', user: userId,
  });
  return user;
};
