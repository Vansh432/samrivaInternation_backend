import { logger } from '../../config/logger.js';
import { sendDynamicEmail } from '../../infrastructure/mail/mail.service.js';
import { EMAIL_TEMPLATE_TYPES } from '../../infrastructure/mail/mail.templates.js';
import { EVENT_TYPES } from '../eventTypes.js';

export const handlers = {
  [EVENT_TYPES.USER_REGISTERED]: async ({ user, templateType = EMAIL_TEMPLATE_TYPES.WELCOME, data = {} }) => {
    if (!user?.email) {
      logger.warn('event.email.userRegistered.missingEmail', { templateType });
      return { sent: false, reason: 'missing_recipient' };
    }

    return sendDynamicEmail({
      to: user.email,
      templateType,
      data: {
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        referralCode: user.referralCode,
        ...data,
      },
    });
  },

  [EVENT_TYPES.KYC_APPROVED]: async ({ user, templateType = EMAIL_TEMPLATE_TYPES.KYC_APPROVED, data = {} }) => {
    if (!user?.email) {
      logger.warn('event.email.kycApproved.missingEmail', { templateType });
      return { sent: false, reason: 'missing_recipient' };
    }

    return sendDynamicEmail({
      to: user.email,
      templateType,
      data: {
        fullName: user.fullName,
        email: user.email,
        investorId: user.investorId,
        folioNumber: user.folioNumber,
        approvedAt: user.kyc?.reviewedAt,
        ...data,
      },
    });
  },

  [EVENT_TYPES.INVESTMENT_APPROVED]: async ({ user, templateType = EMAIL_TEMPLATE_TYPES.INVESTMENT_APPROVED, data = {} }) => {
    if (!user?.email) {
      logger.warn('event.email.investmentApproved.missingEmail', { templateType });
      return { sent: false, reason: 'missing_recipient' };
    }

    return sendDynamicEmail({
      to: user.email,
      templateType,
      data: {
        fullName: user.fullName,
        email: user.email,
        ...data,
      },
    });
  },
};
