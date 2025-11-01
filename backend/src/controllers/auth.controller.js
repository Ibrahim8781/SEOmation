import { AuthService } from '../services/auth.service.js';
import { HTTP } from '../utils/httpStatus.js';

export const AuthController = {
async register(req, res, next) {
try {
const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
const { user, accessToken, refreshToken } = await AuthService.register(req.body, meta);
res.status(HTTP.CREATED).json({ user: sanitize(user), accessToken, refreshToken });
} catch (e) { next(e); }
},
async login(req, res, next) {
try {
const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
const { user, accessToken, refreshToken } = await AuthService.login(req.body, meta);
res.json({ user: sanitize(user), accessToken, refreshToken });
} catch (e) { next(e); }
},
async refresh(req, res, next) {
try {
const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
const { user, accessToken, refreshToken } = await AuthService.refresh(req.body.refreshToken, meta);
res.json({ user: sanitize(user), accessToken, refreshToken });
} catch (e) { next(e); }
},
async logout(req, res, next) {
try {
await AuthService.logout(req.body.refreshToken);
res.status(HTTP.NO_CONTENT).send();
} catch (e) { next(e); }
}
};


function sanitize(u) {
const { passwordHash, ...rest } = u;
return rest;
}
