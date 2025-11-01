import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { UserController } from '../controllers/user.controller.js';
import { updateUserSchema } from '../validators/user.schemas.js';

const r = Router();
r.get('/me', requireAuth(), UserController.me);
r.put('/me', requireAuth(), validate(updateUserSchema), UserController.updateMe);
export default r;
