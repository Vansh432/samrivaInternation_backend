// One-off dev utility: creates (or resets) a super_admin login for the Master Admin Panel.
// Run with: node src/scripts/seedSuperAdmin.js
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import { logger } from '../config/logger.js';
import User from '../modules/users/users.model.js';
import { generateReferralCode } from '../shared/utils/referralCode.js';
import { ROLES, KYC_STATUS, USER_STATUS } from '../shared/constants/index.js';
import mongoose from 'mongoose';

const MOBILE = process.env.SEED_ADMIN_MOBILE || '+919999900001';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

const run = async () => {
  await connectDB();

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  const existing = await User.findOne({ mobile: MOBILE });

  if (existing) {
    existing.password = hashedPassword;
    existing.role = ROLES.SUPER_ADMIN;
    existing.status = USER_STATUS.ACTIVE;
    existing.tokenVersion += 1; // invalidate any old tokens
    await existing.save();
    logger.info('seed.superAdmin.updated', { mobile: MOBILE });
  } else {
    await User.create({
      mobile: MOBILE,
      password: hashedPassword,
      role: ROLES.SUPER_ADMIN,
      fullName: 'Super Admin',
      status: USER_STATUS.ACTIVE,
      referralCode: generateReferralCode(),
      kyc: { status: KYC_STATUS.APPROVED },
    });
    logger.info('seed.superAdmin.created', { mobile: MOBILE });
  }

  console.log('\nSuper admin ready:');
  console.log('  mobile:  ', MOBILE);
  console.log('  password:', PASSWORD);
  console.log('\nChange this password after first login.\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  logger.error('seed.superAdmin.failed', { error: err.message });
  console.error(err);
  process.exit(1);
});
