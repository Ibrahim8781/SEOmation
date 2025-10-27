import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { UserController } from '../controllers/user.controller.js';


const r = Router();
r.get('/me', requireAuth(), UserController.me);
r.put('/me', requireAuth(), UserController.updateMe);
export default r;