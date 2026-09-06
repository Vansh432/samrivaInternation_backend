import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { renderEmailTemplate } from './mail.templates.js';

let transporter;

const isMailConfigured = () => Boolean(
  env.mail.host && env.mail.user && env.mail.password && env.mail.from
);

const getTransporter = () => {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: {
        user: env.mail.user,
        pass: env.mail.password,
      },
    });
  }
  return transporter;
};

export const sendDynamicEmail = async ({ to, templateType, data = {} }) => {
    console.log("email is going")
  if (!to) {
    logger.warn('mail.skipped.missingRecipient', { templateType });
    return { sent: false, reason: 'missing_recipient' };
  }

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    logger.warn('mail.skipped.notConfigured', { templateType, recipient: to });
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const { subject, html, text } = renderEmailTemplate(templateType, data);
    const info = await mailTransporter.sendMail({
      from: env.mail.from,
      to,
      subject,
      html,
      text,
    });
    logger.info('mail.sent', { templateType, recipient: to, messageId: info.messageId });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logger.error('mail.sendFailed', {
      templateType,
      recipient: to,
      error: error.message,
    });
    return { sent: false, reason: 'send_failed' };
  }
};
