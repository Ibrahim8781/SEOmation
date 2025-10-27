import ApiError from '../utils/ApiError.js';
import logger from '../lib/logger.js';


export default function errorHandler(err, req, res, _next) {
const status = err.statusCode || 500;
const payload = {
message: err.message || 'Internal Server Error'
};
if (process.env.NODE_ENV !== 'production' && err.stack) payload.stack = err.stack;
logger.error({ err, path: req.path }, 'Request failed');
res.status(status).json(payload);
}