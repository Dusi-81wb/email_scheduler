import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Strict Google OAuth Routes (No dev login fallback)
router.get('/google', AuthController.googleAuth);
router.get('/google/callback', AuthController.googleCallback);
router.get('/me', requireAuth, AuthController.getMe);
router.post('/logout', requireAuth, AuthController.logout);

export default router;
