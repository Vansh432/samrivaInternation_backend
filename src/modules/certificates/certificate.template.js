import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLAN_TYPES } from '../../shared/constants/index.js';
import { COMPANY_INFO } from '../../shared/constants/company.constant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../../shared/assets/logo.jpeg');

const INK = '#111827';
const MUTED = '#6B7280';
const EMERALD = '#064E3B';
const EMERALD_DARK = '#022C21';
const GOLD = '#D4AF37';
const CREAM = '#FDFBF7';

const fmtINR = (n) => `Rs. ${Math.round(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const maskAadhaar = (a) => (a && a.length >= 4 ? `XXXX XXXX ${a.slice(-4)}` : '-');
const maskPan = (p) => (p ? p : '-');

// A single bordered box with a solid header bar and label/value rows underneath — every
// section of the certificate (Issue/Investor/Investment/Nominee details) is built from this
// one primitive so the layout stays visually consistent no matter what data it's fed.
const drawBoxedSection = (doc, { x, y, width, height, title, rows }) => {
  doc.save();
  doc.rect(x, y, width, height).lineWidth(0.75).stroke(EMERALD);
  doc.rect(x, y, width, 20).fill(EMERALD_DARK);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(title, x + 8, y + 6, { width: width - 16 });
  doc.restore();

  let rowY = y + 28;
  const labelWidth = width * 0.52;
  const rowHeight = 17;
  rows.forEach(([label, value]) => {
    doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(label, x + 8, rowY, { width: labelWidth - 8 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(7.5).text(String(value ?? '-'), x + labelWidth, rowY, { width: width - labelWidth - 8 });
    rowY += rowHeight;
  });
  return rowY;
};

// The single dynamic template every certificate is rendered from — nothing in here is
// specific to one investment; every visible field comes from `data`, so a new debenture
// certificate is always "the same template, different data" rather than a one-off file.
export const renderCertificatePdf = async (data) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 24;
  const innerX = margin + 10;
  const innerY = margin + 10;
  const innerWidth = pageWidth - (margin + 10) * 2;

  // Outer double-rule border (emerald outer, gold inner) — a simplified stand-in for the
  // ornate flourish border until real artwork is supplied.
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2).lineWidth(3).stroke(EMERALD_DARK);
  doc.rect(margin + 6, margin + 6, pageWidth - (margin + 6) * 2, pageHeight - (margin + 6) * 2).lineWidth(1).stroke(GOLD);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2).fillOpacity(1);

  let cursorY = innerY;

  // --- Header row: cert identifiers | logo & titles | CIN + QR ---
  const idColWidth = 150;
  doc.fontSize(7).font('Helvetica').fillColor(MUTED);
  [
    ['Certificate No.', data.certificateNumber],
    ['Folio No.', data.folioNumber],
    ['Investor ID', data.investorId],
  ].forEach(([label, value], i) => {
    const y = cursorY + i * 16;
    doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(label, innerX, y, { width: 70 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8).text(value || '-', innerX + 72, y, { width: idColWidth - 72 });
  });

  const centerX = innerX + idColWidth;
  const centerWidth = innerWidth - idColWidth * 2;
  try {
    doc.image(LOGO_PATH, innerX + centerWidth / 2 + idColWidth - 15, cursorY - 6, { width: 30, height: 30 });
  } catch {
    // Logo asset missing — certificate still generates, just without the mark.
  }
  doc.fillColor(EMERALD_DARK).font('Helvetica-Bold').fontSize(18).text(COMPANY_INFO.name, centerX, cursorY + 28, { width: centerWidth, align: 'center' });
  doc.fillColor(INK).font('Helvetica').fontSize(7.5).text('SECURED REDEEMABLE NON-CONVERTIBLE DEBENTURES', centerX, cursorY + 48, { width: centerWidth, align: 'center' });
  doc.fillColor(EMERALD).font('Helvetica-Bold').fontSize(13).text('DEBENTURE CERTIFICATE', centerX, cursorY + 60, { width: centerWidth, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(6.5).text(
    'Issued under the applicable provisions of the Companies Act, 2013 and the Terms of the Debenture Issue',
    centerX, cursorY + 78, { width: centerWidth, align: 'center' }
  );

  const qrX = innerX + innerWidth - 90;
  doc.fillColor(INK).font('Helvetica').fontSize(7).text(`CIN: ${COMPANY_INFO.cin}`, qrX - 60, cursorY, { width: 150, align: 'right' });
  const qrPayload = JSON.stringify({ certNo: data.certificateNumber, investorId: data.investorId, issued: data.issueDate });
  const qrBuffer = await QRCode.toBuffer(qrPayload, { margin: 0, width: 200 });
  doc.image(qrBuffer, qrX, cursorY + 12, { width: 58, height: 58 });
  doc.fillColor(MUTED).font('Helvetica').fontSize(6.5).text('Scan to Verify Certificate', qrX - 20, cursorY + 72, { width: 98, align: 'center' });

  cursorY += 102;

  // --- Four-column details grid ---
  const gap = 8;
  const colWidth = (innerWidth - gap * 3) / 4;
  const gridTop = cursorY;
  // Sized for the tallest column (Investment Details has 11 rows) — 28 header + 11*17 rows + padding.
  const gridHeight = 230;

  drawBoxedSection(doc, {
    x: innerX, y: gridTop, width: colWidth, height: gridHeight, title: 'ISSUE DETAILS',
    rows: [
      ['Issue Date', fmtDate(data.issueDate)],
      ['Date of Allotment', fmtDate(data.dateOfAllotment)],
      ['Maturity Date', fmtDate(data.maturityDate)],
      ['Redemption Date', fmtDate(data.redemptionDate)],
      ['Debenture No(s).', data.debentureNoStart === data.debentureNoEnd ? data.debentureNoStart : `${data.debentureNoStart} - ${data.debentureNoEnd}`],
      ['ISIN', COMPANY_INFO.isin],
    ],
  });

  drawBoxedSection(doc, {
    x: innerX + colWidth + gap, y: gridTop, width: colWidth, height: gridHeight, title: 'INVESTOR DETAILS',
    rows: [
      ['Investor Name', data.investorName],
      ["Father's/Husband", data.fatherOrHusbandName || '-'],
      ['Date of Birth', fmtDate(data.dob)],
      ['PAN Number', maskPan(data.pan)],
      ['Aadhaar Number', maskAadhaar(data.aadhaar)],
      ['Mobile Number', data.mobile],
      ['Email ID', data.email || '-'],
      ['Address', data.addressLine],
    ],
  });

  drawBoxedSection(doc, {
    x: innerX + (colWidth + gap) * 2, y: gridTop, width: colWidth, height: gridHeight, title: 'INVESTMENT DETAILS',
    rows: [
      ['Investment Plan', data.planType === PLAN_TYPES.COMPOUNDING ? 'Growth Plan' : 'Monthly Income Plan'],
      ['Tenure', `${data.tenureMonths} Months`],
      ['Unit Range', data.unitRangeMax ? `${data.unitRangeMin} to ${data.unitRangeMax} Units` : `${data.unitRangeMin}+ Units`],
      ['Number of Units', data.units],
      ['Face Value/Unit', fmtINR(data.unitValueInr)],
      ['Total Face Value', fmtINR(data.principal)],
      ['Investment Amount', fmtINR(data.principal)],
      ['Lock-in Period', `${COMPANY_INFO.lockInMonths} Months`],
      ['Applicable Rate', `${data.ratePercent.toFixed(2)}% p.a.`],
      ['Interest Payment', data.planType === PLAN_TYPES.COMPOUNDING ? 'On Maturity' : 'Monthly'],
      ['Maturity Amt. (Est.)', fmtINR(data.maturityAmount)],
    ],
  });

  drawBoxedSection(doc, {
    x: innerX + (colWidth + gap) * 3, y: gridTop, width: colWidth, height: gridHeight, title: 'NOMINEE DETAILS',
    rows: [
      ['Nominee Name', data.nomineeName || '-'],
      ['Relationship', data.nomineeRelation || '-'],
      ['Date of Birth', data.nomineeDob ? fmtDate(data.nomineeDob) : '-'],
      ['Nominee Share', `${data.nomineeSharePercent || 100}%`],
    ],
  });

  cursorY = gridTop + gridHeight + 14;

  // --- Terms / withdrawal conditions ---
  const termsHeight = 90;
  doc.rect(innerX, cursorY, innerWidth, termsHeight).lineWidth(0.75).stroke(EMERALD);
  doc.rect(innerX, cursorY, innerWidth, 18).fill(EMERALD_DARK);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text('WITHDRAWAL CONDITIONS', innerX + 8, cursorY + 5);

  const termsText = data.planType === PLAN_TYPES.COMPOUNDING
    ? `Growth Plan: Mandatory lock-in of ${COMPANY_INFO.lockInMonths} months. Withdrawal before ${COMPANY_INFO.lockInMonths} months forfeits all profit and refunds 80% of principal only. After ${COMPANY_INFO.lockInMonths} months, 100% principal is refundable and profit is payable only on completed tenure milestones.`
    : `Monthly Income Plan: Mandatory lock-in of ${COMPANY_INFO.lockInMonths} months. Premature withdrawal is settled per the applicable completed-tenure slab in the Debenture Information Memorandum; any excess monthly income already paid is adjusted before redemption.`;
  doc.fillColor(INK).font('Helvetica').fontSize(7.5).text(termsText, innerX + 8, cursorY + 26, { width: innerWidth - 220, lineGap: 2 });

  // Unit-value seal (drawn, not a scanned image) + Security badge, right-aligned within the
  // terms box. sealCy is offset (not dead-center) so the circle clears both the header bar
  // above and the box's bottom border.
  const sealCx = innerX + innerWidth - 150;
  const sealCy = cursorY + 56;
  doc.save();
  doc.circle(sealCx, sealCy, 30).lineWidth(1.5).stroke(GOLD);
  doc.circle(sealCx, sealCy, 26).lineWidth(0.5).stroke(GOLD);
  doc.fillColor(EMERALD_DARK).font('Helvetica-Bold').fontSize(7).text('ONE UNIT', sealCx - 30, sealCy - 12, { width: 60, align: 'center' });
  doc.fontSize(8).text('=', sealCx - 30, sealCy - 2, { width: 60, align: 'center' });
  doc.fontSize(7).text(fmtINR(data.unitValueInr), sealCx - 30, sealCy + 8, { width: 60, align: 'center' });
  doc.restore();

  const badgeX = innerX + innerWidth - 70;
  doc.save();
  doc.roundedRect(badgeX - 34, sealCy - 24, 68, 48, 4).lineWidth(1).stroke(EMERALD);
  doc.fillColor(EMERALD).font('Helvetica-Bold').fontSize(7).text('SECURED', badgeX - 34, sealCy - 18, { width: 68, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(5.5).text('Backed by assets per the Debenture Trust Deed', badgeX - 34, sealCy - 4, { width: 68, align: 'center', lineGap: 1 });
  doc.restore();

  cursorY += termsHeight + 14;

  // --- Footer: acknowledgement + signatures ---
  const footerHeight = pageHeight - margin - 10 - cursorY;
  doc.fillColor(INK).font('Helvetica').fontSize(7.5).text(
    'This is to certify that the above-named Debenture Holder is the registered holder of the Debentures described herein and is entitled to the rights, benefits and obligations contained in the Debenture Information Memorandum and applicable laws. The Company undertakes to redeem the Debentures in accordance with the terms of the issue.',
    innerX, cursorY, { width: innerWidth - 260, lineGap: 2 }
  );

  // Barcode-style security texture (visual only — not a scannable symbology; the QR above
  // is the real machine-readable verification code).
  const barcodeSeed = (data.certificateNumber || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  let bx = innerX;
  for (let i = 0; i < 40; i++) {
    const w = 1 + ((barcodeSeed * (i + 1)) % 3);
    if (i % 2 === 0) doc.rect(bx, cursorY + footerHeight - 26, w, 18).fill(INK);
    bx += w + 1.5;
  }
  doc.fillColor(MUTED).font('Helvetica').fontSize(6).text('This certificate is system generated and does not require a physical signature.', innerX, cursorY + footerHeight - 6, { width: 260 });

  const sigColX = innerX + innerWidth - 240;
  doc.moveTo(sigColX, cursorY + footerHeight - 30).lineTo(sigColX + 100, cursorY + footerHeight - 30).lineWidth(0.75).stroke(MUTED);
  doc.fillColor(INK).font('Helvetica').fontSize(7).text('Director', sigColX, cursorY + footerHeight - 20, { width: 100, align: 'center' });

  const sigColX2 = innerX + innerWidth - 110;
  doc.moveTo(sigColX2, cursorY + footerHeight - 30).lineTo(sigColX2 + 100, cursorY + footerHeight - 30).lineWidth(0.75).stroke(MUTED);
  doc.fillColor(INK).font('Helvetica').fontSize(7).text('Director', sigColX2, cursorY + footerHeight - 20, { width: 100, align: 'center' });

  doc.end();
  return done;
};
