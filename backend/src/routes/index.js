import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import topicRoutes from './topic.routes.js';
import contentRoutes from './content.routes.js';
import seoRoutes from './seo.routes.js';
import integrationRoutes from './integration.routes.js';
import scheduleRoutes from './schedule.routes.js';


const router = Router();
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/topics', topicRoutes);
router.use('/content', contentRoutes);
router.use('/seo', seoRoutes);
router.use('/integrations', integrationRoutes);
router.use('/schedule', scheduleRoutes);
export default router;
