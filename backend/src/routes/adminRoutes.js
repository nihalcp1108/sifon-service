import { Router } from 'express';
import { updateProfile, updateEmail, updatePassword } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = Router();

router.use(requireAuth);
router.use(csrfProtection);

router.patch('/profile', updateProfile);
router.patch('/email', updateEmail);
router.patch('/password', updatePassword);

export default router;

