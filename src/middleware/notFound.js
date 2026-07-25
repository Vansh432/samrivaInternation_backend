import { sendError } from '../shared/responses/response.js';

export const notFound = (req, res) => {
  return sendError(res, { statusCode: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export default notFound;
