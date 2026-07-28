import fs from 'fs';
import path from 'path';
import { UPLOAD_ROOT } from '../../middleware/upload.js';
import { renderCertificatePdf } from './certificate.template.js';
import { computeDerivedFields } from '../investments/investments.service.js';

const CERT_DIR = path.join(UPLOAD_ROOT, 'certificates');
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

const formatAddress = (address) => {
  if (!address) return '-';
  return [address.line1, address.city, address.state, address.pincode].filter(Boolean).join(', ') || '-';
};

// Assembles certificate data from the approved investment + its owning user, renders the
// PDF from the single shared template, and writes it to disk. Returns the path relative to
// the existing /uploads static route (see app.js) — callers prefix it with the request's
// own protocol/host, same convention as uploads.controller.js.
export const generateInvestmentCertificate = async (investment, user) => {
  const derived = computeDerivedFields(investment);
  const nominee = user.kyc?.nominee || {};

  const pdfBuffer = await renderCertificatePdf({
    certificateNumber: investment.certificateNumber,
    folioNumber: user.folioNumber,
    investorId: user.investorId,
    issueDate: investment.dateOfAllotment,
    dateOfAllotment: investment.dateOfAllotment,
    maturityDate: investment.maturityDate,
    redemptionDate: investment.redemptionDate,
    debentureNoStart: investment.debentureNoStart,
    debentureNoEnd: investment.debentureNoEnd,
    investorName: user.fullName,
    fatherOrHusbandName: user.fatherOrHusbandName,
    dob: user.dob,
    pan: user.kyc?.pan,
    aadhaar: user.kyc?.aadhaar,
    mobile: user.mobile,
    email: user.email,
    addressLine: formatAddress(user.address),
    planType: investment.planType,
    tenureMonths: investment.tenureMonths,
    unitRangeMin: investment.unitRangeMin,
    unitRangeMax: investment.unitRangeMax,
    units: investment.units,
    unitValueInr: investment.unitValueInr,
    principal: investment.principal,
    ratePercent: investment.ratePercent,
    maturityAmount: derived.maturityAmount,
    nomineeName: nominee.name,
    nomineeRelation: nominee.relation,
    nomineeDob: nominee.dob,
    nomineeSharePercent: nominee.sharePercent,
  });

  const filename = `${investment.certificateNumber}.pdf`;
  fs.writeFileSync(path.join(CERT_DIR, filename), pdfBuffer);

  return `/uploads/certificates/${filename}`;
};

// Resolves the certificate PDF already generated for an investment (see above) to an
// absolute disk path, for the authenticated download endpoint. Returns null if it hasn't
// been generated yet (investment not approved) or the file is otherwise missing.
export const resolveCertificateFile = (investment) => {
  const filePath = path.join(CERT_DIR, `${investment.certificateNumber}.pdf`);
  return fs.existsSync(filePath) ? filePath : null;
};
