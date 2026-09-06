import { COMPANY_INFO } from '../../shared/constants/company.constant.js';

const BRAND = {
  emerald: '#064E3B',
  emeraldDark: '#022C21',
  gold: '#D4AF37',
  cream: '#FDFBF7',
  ink: '#17212B',
  muted: '#64748B',
  border: '#E5E7EB',
};

export const EMAIL_TEMPLATE_TYPES = Object.freeze({
  WELCOME: 'welcome',
  KYC_APPROVED: 'kyc-approved',
  INVESTMENT_APPROVED: 'investment-approved',
});

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const displayValue = (value, fallback = '-') => escapeHtml(value || fallback);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Rs. ${amount.toLocaleString('en-IN')}` : '-';
};

const formatLabel = (value) => displayValue(String(value || '-').replace(/[_-]+/g, ' '));

const detailRows = (rows) => rows
  .map(([label, value]) => `<tr>
    <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:13px;width:46%;">${escapeHtml(label)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${BRAND.ink};font-size:13px;font-weight:600;">${value}</td>
  </tr>`)
  .join('');

const detailsTable = (rows) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${BRAND.border};border-radius:8px;border-collapse:separate;overflow:hidden;">
  ${detailRows(rows)}
</table>`;

const button = (label, url) => url
  ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND.emerald};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:13px 22px;border-radius:6px;">${escapeHtml(label)}</a>`
  : '';

const renderLayout = ({ preheader, eyebrow, title, greeting, body, details, cta, note }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#F3F6F4;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F3F6F4;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;background:#FFFFFF;border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;">
        <tr><td style="background:${BRAND.emeraldDark};padding:24px 30px;border-bottom:4px solid ${BRAND.gold};">
          <div style="font-size:20px;line-height:1.2;font-weight:800;letter-spacing:1.5px;color:#FFFFFF;">SAMVIRA</div>
          <div style="margin-top:4px;font-size:11px;letter-spacing:2px;color:#DDEDE6;">INTERNATIONAL</div>
        </td></tr>
        <tr><td style="padding:34px 30px 30px;">
          <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.5px;color:${BRAND.gold};">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:10px 0 18px;font-size:27px;line-height:1.25;color:${BRAND.emeraldDark};font-weight:700;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${greeting}</p>
          <div style="font-size:15px;line-height:1.7;color:${BRAND.muted};">${body}</div>
          ${details ? `<div style="margin:24px 0;">${details}</div>` : ''}
          ${cta ? `<div style="margin:28px 0 8px;">${cta}</div>` : ''}
          ${note ? `<p style="margin:24px 0 0;padding:14px 16px;background:${BRAND.cream};border-left:3px solid ${BRAND.gold};font-size:13px;line-height:1.6;color:${BRAND.muted};">${note}</p>` : ''}
        </td></tr>
        <tr><td style="padding:20px 30px;background:#F8FAF9;border-top:1px solid ${BRAND.border};">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};">This is an automated message from ${escapeHtml(COMPANY_INFO.name)}. Please do not reply to this email.</p>
          <p style="margin:8px 0 0;font-size:12px;color:${BRAND.muted};">© ${new Date().getFullYear()} ${escapeHtml(COMPANY_INFO.name)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const greeting = (name) => `Dear <strong style="color:${BRAND.ink};">${displayValue(name, 'Member')}</strong>,`;

const welcomeTemplate = (data = {}) => {
  const name = data.fullName || data.name;
  return {
    subject: 'Welcome to Samvira International',
    html: renderLayout({
      preheader: 'Your Samvira International account has been created successfully.',
      eyebrow: 'ACCOUNT CREATED',
      title: 'Welcome to Samvira International',
      greeting: greeting(name),
      body: `Your account has been created successfully. We are pleased to welcome you to the Samvira International community and look forward to supporting your financial journey.`,
      details: detailsTable([
        ['Registered mobile', displayValue(data.mobile)],
        ['Registered email', displayValue(data.email)],
        ['Account role', formatLabel(data.role || 'investor')],
        ...(data.referralCode ? [['Referral code', displayValue(data.referralCode)]] : []),
      ]),
      cta: button('Open Samvira', data.loginUrl || data.dashboardUrl),
      note: 'Keep your login details private. Samvira International will never ask you to share your password or one-time passwords by email.',
    }),
    text: `Dear ${name || 'Member'},\n\nWelcome to Samvira International. Your account has been created successfully.\n\nRegistered mobile: ${data.mobile || '-'}\nRegistered email: ${data.email || '-'}\nAccount role: ${data.role || 'investor'}\n\nWe look forward to supporting your financial journey.`,
  };
};

const kycApprovedTemplate = (data = {}) => {
  const name = data.fullName || data.name;
  return {
    subject: 'Your KYC has been approved',
    html: renderLayout({
      preheader: 'Your Samvira International KYC verification is complete.',
      eyebrow: 'VERIFICATION COMPLETE',
      title: 'Your KYC has been approved',
      greeting: greeting(name),
      body: 'Your KYC documents have been reviewed and approved successfully. Your Samvira International account is now verified for the next stage of your investment journey.',
      details: detailsTable([
        ['Verification status', `<span style="color:${BRAND.emerald};">Approved</span>`],
        ['Investor ID', displayValue(data.investorId)],
        ['Folio number', displayValue(data.folioNumber)],
        ['Approved on', escapeHtml(formatDate(data.approvedAt || new Date()))],
      ]),
      cta: button('View your account', data.dashboardUrl),
      note: 'Please ensure your profile and bank details remain accurate. Contact support through the official Samvira International channels if you notice anything unexpected.',
    }),
    text: `Dear ${name || 'Member'},\n\nYour KYC documents have been reviewed and approved successfully.\n\nInvestor ID: ${data.investorId || '-'}\nFolio number: ${data.folioNumber || '-'}\nApproved on: ${formatDate(data.approvedAt || new Date())}\n\nYour account is now verified for the next stage of your investment journey.`,
  };
};

const investmentApprovedTemplate = (data = {}) => {
  const name = data.fullName || data.name;
  const planName = data.planName || data.planType;
  return {
    subject: 'Your investment plan has been approved',
    html: renderLayout({
      preheader: 'Your investment plan has been approved and its tenure has started.',
      eyebrow: 'INVESTMENT CONFIRMED',
      title: 'Your plan is approved and active',
      greeting: greeting(name),
      body: 'Your debenture investment has been approved by our team. The investment tenure has now started, and the details below have been recorded for your reference.',
      details: detailsTable([
        ['Plan', formatLabel(planName)],
        ['Certificate number', displayValue(data.certificateNumber)],
        ['Units', displayValue(data.units)],
        ['Principal amount', escapeHtml(formatMoney(data.principal))],
        ['Tenure started', escapeHtml(formatDate(data.startDate))],
        ['Maturity date', escapeHtml(formatDate(data.maturityDate))],
        ...(data.debentureNoStart || data.debentureNoEnd
          ? [['Debenture numbers', `${displayValue(data.debentureNoStart)} to ${displayValue(data.debentureNoEnd)}`]]
          : []),
      ]),
      cta: button('View investment details', data.dashboardUrl || data.investmentUrl),
      note: 'Please retain this email for your records. Your certificate may be available from your Samvira International account once document processing is complete.',
    }),
    text: `Dear ${name || 'Member'},\n\nYour investment plan has been approved and its tenure has started.\n\nPlan: ${planName || '-'}\nCertificate number: ${data.certificateNumber || '-'}\nUnits: ${data.units || '-'}\nPrincipal amount: ${formatMoney(data.principal)}\nTenure started: ${formatDate(data.startDate)}\nMaturity date: ${formatDate(data.maturityDate)}\nDebenture numbers: ${data.debentureNoStart || '-'} to ${data.debentureNoEnd || '-'}\n\nPlease retain this email for your records.`,
  };
};

const templates = {
  [EMAIL_TEMPLATE_TYPES.WELCOME]: welcomeTemplate,
  [EMAIL_TEMPLATE_TYPES.KYC_APPROVED]: kycApprovedTemplate,
  [EMAIL_TEMPLATE_TYPES.INVESTMENT_APPROVED]: investmentApprovedTemplate,
};

export const renderEmailTemplate = (templateType, data = {}) => {
  const template = templates[templateType];
  if (!template) throw new Error(`Unknown email template: ${templateType}`);
  return template(data);
};

export const emailTemplates = Object.freeze({
  welcome: welcomeTemplate,
  kycApproved: kycApprovedTemplate,
  investmentApproved: investmentApprovedTemplate,
});
