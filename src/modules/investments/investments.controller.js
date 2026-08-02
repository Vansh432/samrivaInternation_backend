import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/responses/response.js';
import { AppError } from '../../shared/errors/AppError.js';
import { resolveCertificateFile } from '../certificates/certificate.service.js';
import * as investmentsService from './investments.service.js';

export const quote = asyncHandler(async (req, res) => {
  const { planType, units, tenureMonths } = req.query;
  const data = await investmentsService.getInvestmentQuote({
    planType,
    units: Number(units),
    tenureMonths: Number(tenureMonths),
  });
  return sendSuccess(res, { message: 'Investment quote', data });
});

export const create = asyncHandler(async (req, res) => {
  const investment = await investmentsService.createUserInvestment(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Investment created', data: { investment } });
});

export const list = asyncHandler(async (req, res) => {
  const investments = await investmentsService.getUserInvestments(req.user._id);
  return sendSuccess(res, { message: 'Investments', data: { investments } });
});

export const getById = asyncHandler(async (req, res) => {
  const investment = await investmentsService.getUserInvestmentById(req.user._id, req.params.id);
  return sendSuccess(res, { message: 'Investment detail', data: { investment } });
});

export const summary = asyncHandler(async (req, res) => {
  const data = await investmentsService.getUserInvestmentSummary(req.user._id);
  return sendSuccess(res, { message: 'Investment summary', data });
});

export const renewable = asyncHandler(async (req, res) => {
  const investments = await investmentsService.getRenewableInvestments(req.user._id);
  return sendSuccess(res, { message: 'Renewable investments', data: { investments } });
});

export const renew = asyncHandler(async (req, res) => {
  const investment = await investmentsService.createRenewalInvestment(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Investment renewed', data: { investment } });
});

export const downloadCertificate = asyncHandler(async (req, res) => {
  const investment = await investmentsService.getUserInvestmentById(req.user._id, req.params.id);
  const filePath = investment.certificatePdfUrl ? resolveCertificateFile(investment) : null;
  if (!filePath) {
    throw new AppError("Certificate isn't ready yet — please check back shortly.", 404);
  }
  return res.download(filePath, `${investment.certificateNumber}.pdf`);
});
