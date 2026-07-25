import { logger } from '../../config/logger.js';
import { KYC_STATUS } from '../../shared/constants/index.js';
import { updateUserById } from './users.repository.js';

export const updateProfile = async (userId, { fullName, email, dob, address }) => {
  logger.info('users.updateProfile.attempt', { userId: userId.toString() });

  const update = {};
  if (fullName !== undefined) update.fullName = fullName;
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
  return user;
};

export const submitKyc = async (userId, { pan, aadhaar, bank, nominee, addressProofUrl, selfieUrl }) => {
  logger.info('users.submitKyc.attempt', { userId: userId.toString() });

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
  return user;
};
