import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  checkProviderStatus,
  sendTestMessage,
} from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getSettings);
router.patch('/', csrfProtection, updateSettings);
router.get('/status', checkProviderStatus);
router.post('/test', csrfProtection, sendTestMessage);

export default router;

