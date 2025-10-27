import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import { prisma } from '../lib/prisma.js';


export function requireAuth() {
return async (req, _res, next) => {
try {
const header = req.headers.authorization || '';
const token = header.startsWith('Bearer ') ? header.slice(7) : null;
if (!token) throw new ApiError(401, 'Missing access token');


const payload = jwt.verify(token, config.jwt.accessSecret);
const user = await prisma.user.findUnique({ where: { id: payload.sub } });
if (!user) throw new ApiError(401, 'User not found');
req.user = user;
next();
} catch (e) {
next(new ApiError(401, 'Unauthorized'));
}
};
}


export function requireRole(role) {
return (req, _res, next) => {
if (req.user?.role !== role) return next(new ApiError(403, 'Forbidden'));
next();
};
}