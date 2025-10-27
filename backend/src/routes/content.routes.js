import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generateContentSchema, updateContentSchema } from '../validators/content.schemas.js';
import { ContentController } from '../controllers/content.controller.js';


const r = Router();
r.post('/generate', requireAuth(), validate(generateContentSchema), ContentController.generate);
r.get('/', requireAuth(), ContentController.list);
r.get('/:id', requireAuth(), ContentController.getById);
r.put('/:id', requireAuth(), validate(updateContentSchema), ContentController.update);
export default r;