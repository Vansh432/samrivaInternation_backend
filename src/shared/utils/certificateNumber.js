import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

export const generateCertificateNumber = (length = 8) => {
  const bytes = crypto.randomBytes(length);
  let code = 'SMR-DEB-';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
};

export default generateCertificateNumber;
