import mongoose from 'mongoose';
import { ROLES, KYC_STATUS, RANKS, USER_STATUS } from '../../shared/constants/index.js';

const userSchema = new mongoose.Schema(
  {
    // --- Identity / auth ---
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\+\d{10,14}$/,
    },
    password: { type: String, required: true, select: false }, // bcrypt hash
    role: { type: String, enum: Object.values(ROLES), default: ROLES.INVESTOR },
    fullName: { type: String, trim: true },
    fatherOrHusbandName: { type: String, trim: true }, // Shown on the debenture certificate
    email: { type: String, trim: true, lowercase: true },
    dob: Date,
    address: { line1: String, city: String, state: String, pincode: String }, // Profile step (register.tsx step 0)
    profileImage: String,
    // Assigned once, at KYC approval (see admin.service.js#approveKyc) — reused across every
    // certificate this investor ever receives, unlike certificateNumber which is per-investment.
    investorId: { type: String, unique: true, sparse: true },
    folioNumber: { type: String, unique: true, sparse: true },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    lastLoginAt: Date,
    tokenVersion: { type: Number, default: 0 }, // bump to invalidate all refresh tokens (logout-all / password change)

    // --- KYC (frontend register.tsx steps 1-5: PAN/Aadhaar, Bank, Nominee, Address&Selfie, Terms) ---
    kyc: {
      status: { type: String, enum: Object.values(KYC_STATUS), default: KYC_STATUS.PENDING },
      pan: String,
      aadhaar: String, // TODO(future): field-level encryption before storing
      bank: { accountNumber: String, ifsc: String, holderName: String },
      nominee: { name: String, relation: String, dob: Date, sharePercent: { type: Number, default: 100, min: 1, max: 100 } },
      addressProofUrl: String,
      selfieUrl: String,
      termsAcceptedAt: Date,
      rejectionReason: String,
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },

    // --- MLM / sponsorship (future-scope-ready now) ---
    referralCode: { type: String, unique: true, sparse: true, index: true }, // this user's own shareable ID
    sponsor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // nearest-first upline chain, enables O(1) "is Y within my Nth generation" checks for Leadership Override (up to gen 3) without recursive queries
    depth: { type: Number, default: 0 }, // distance from root sponsor

    rank: {
      current: { type: String, enum: Object.values(RANKS), default: RANKS.INVESTOR },
      achievedAt: Date,
      highestAchieved: { type: String, enum: Object.values(RANKS), default: RANKS.INVESTOR }, // guards Rank Advancement Bonus from re-firing on a later demotion/requalify
    },

    // Denormalized team cache — recomputed by a scheduled job/service, not authoritative (raw investment/downline data is authoritative)
    teamStats: {
      directCount: { type: Number, default: 0 },
      activeDirectCount: { type: Number, default: 0 },
      teamCount: { type: Number, default: 0 },
      teamBusinessVolume: { type: Number, default: 0 },
      personalBusinessVolume: { type: Number, default: 0 },
      recalculatedAt: Date,
    },

    // Idempotency guards for one-time / slab-based bonuses, avoids double-payout on retry
    bonusFlags: {
      fastStartClaimedSlabs: [Number], // unit thresholds already paid
      retentionClaimedSlabs: [Number],
      lastAccrualPeriod: String, // e.g. "2026-07", for POST /bonuses/accrue idempotency
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ 'kyc.status': 1 });
userSchema.index({ 'rank.current': 1 });

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export default User;
