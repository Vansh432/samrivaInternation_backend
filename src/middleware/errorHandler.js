import { logger } from '../config/logger.js';
import { sendError } from '../shared/responses/response.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Something went wrong';

  if (statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
  } else {
    logger.warn(err.message, { path: req.originalUrl, method: req.method, statusCode });
  }

  return sendError(res, { statusCode, message, errors: err.errors || [] });
};

export default errorHandler;
