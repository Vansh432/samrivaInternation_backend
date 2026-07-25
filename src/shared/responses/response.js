export const sendSuccess = (res, { statusCode = 200, message = '', data = {} } = {}) => {
  return res.status(statusCode).json({ status: true, message, data });
};

export const sendError = (res, { statusCode = 500, message = '', errors = [] } = {}) => {
  return res.status(statusCode).json({ status: false, message, errors });
};
