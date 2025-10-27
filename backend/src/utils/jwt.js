import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';


export function signAccessToken(user) {
return jwt.sign({ sub: user.id, role: user.role }, config.jwt.accessSecret, {
expiresIn: config.jwt.accessExpires
});
}


export function signRefreshToken(user) {
return jwt.sign({ sub: user.id }, config.jwt.refreshSecret, {
expiresIn: config.jwt.refreshExpires
});
}