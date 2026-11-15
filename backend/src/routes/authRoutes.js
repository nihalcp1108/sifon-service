import { Router } from 'express';
import { getCsrf, login, logout, getMe } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/csrf', getCsrf);
router.post('/login', loginLimiter, login);
router.post('/logout', requireAuth, csrfProtection, logout);
router.get('/me', requireAuth, getMe);

export default router;

