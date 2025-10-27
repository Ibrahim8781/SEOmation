import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.schemas.js';
import { AuthController } from '../controllers/auth.controller.js';


const r = Router();


r.post('/register', authLimiter, validate(registerSchema), AuthController.register);
r.post('/login', authLimiter, validate(loginSchema), AuthController.login);
r.post('/refresh', validate(refreshSchema), AuthController.refresh);
r.post('/logout', AuthController.logout);


export default r;