import { validationResult } from 'express-validator';
import { sendError } from '../shared/responses/response.js';

export const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return sendError(res, { statusCode: 422, message: 'Validation failed', errors });
};

export default validate;
