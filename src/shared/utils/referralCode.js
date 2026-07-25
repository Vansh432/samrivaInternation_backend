import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

export const generateReferralCode = (length = 8) => {
  const bytes = crypto.randomBytes(length);
  let code = 'SMR';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
};

export default generateReferralCode;
