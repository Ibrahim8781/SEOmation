import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generateTopicsSchema } from '../validators/topic.schemas.js';
import { TopicController } from '../controllers/topic.controller.js';


const r = Router();
r.post('/generate', requireAuth(), validate(generateTopicsSchema), TopicController.generate);
r.get('/', requireAuth(), TopicController.list);
export default r;