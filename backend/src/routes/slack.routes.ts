import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/authorize', SlackController.authorize);
router.get('/callback', SlackController.callback);
router.post('/webhook', requireAuth, SlackController.saveWebhook);
router.get('/status', requireAuth, SlackController.getStatus);
router.post('/test-alert', requireAuth, SlackController.testAlert);
router.post('/disconnect', requireAuth, SlackController.disconnect);

export default router;
