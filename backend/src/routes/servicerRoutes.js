import { Router } from 'express';
import {
  getServicers,
  createServicer,
  updateServicer,
  toggleServicerStatus,
} from '../controllers/servicerController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getServicers);
router.post('/', csrfProtection, createServicer);
router.patch('/:id', csrfProtection, updateServicer);
router.patch('/:id/status', csrfProtection, toggleServicerStatus);

export default router;

