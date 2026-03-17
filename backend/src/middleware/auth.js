import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import { prisma } from '../lib/prisma.js';

function normalizeAuthError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error?.name === 'TokenExpiredError') {
    return new ApiError(401, 'Access token expired');
  }

  if (error?.name === 'JsonWebTokenError' || error?.name === 'NotBeforeError') {
    return new ApiError(401, 'Invalid access token');
  }

  return new ApiError(401, 'Unauthorized');
}

export function requireAuth() {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        throw new ApiError(401, 'Missing access token');
      }

      const payload = jwt.verify(token, config.jwt.accessSecret);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new ApiError(401, 'User not found');
      }

      req.user = user;
      next();
    } catch (error) {
      const authError = normalizeAuthError(error);
      authError.meta = { errorName: error?.name };
      next(authError);
    }
  };
}


export function requireRole(role) {
  return (req, _res, next) => {
    if (req.user?.role !== role) return next(new ApiError(403, 'Forbidden'));
    next();
  };
}
