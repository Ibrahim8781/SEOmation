import logger from '../lib/logger.js';


export default function errorHandler(err, req, res, next) {
  void next;
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const payload = { message };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  const logPayload = {
    path: req.path,
    method: req.method,
    statusCode: status,
    userId: req.user?.id,
    errorName: err.meta?.errorName
  };

  if (status >= 500) {
    logger.error({ ...logPayload, err }, 'Request failed');
  } else if (status >= 400) {
    logger.warn({ ...logPayload, message }, 'Request rejected');
  } else {
    logger.info(logPayload, 'Request completed with non-error status');
  }

  res.status(status).json(payload);
}
