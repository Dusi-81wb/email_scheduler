import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/senders', EmailController.getSenders);
router.post('/schedule', requireAuth, EmailController.scheduleEmails);
router.get('/scheduled', requireAuth, EmailController.getScheduledEmails);
router.get('/sent', requireAuth, EmailController.getSentEmails);
router.get('/search', requireAuth, EmailController.searchEmails);

export default router;
