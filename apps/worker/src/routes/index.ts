import { Router } from 'express';
import webhookRoutes from './webhook.routes.js';

const router: Router = Router();

router.use('/webhooks', webhookRoutes);

export default router;
