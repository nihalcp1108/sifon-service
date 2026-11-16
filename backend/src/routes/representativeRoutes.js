import { Router } from 'express';
import {
  getRepresentatives,
  getRepresentativeById,
  createRepresentative,
  updateRepresentative,
  toggleRepresentativeStatus,
  deleteRepresentative,
} from '../controllers/representativeController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getRepresentatives);
router.post('/', csrfProtection, createRepresentative);
router.get('/:id', getRepresentativeById);
router.patch('/:id', csrfProtection, updateRepresentative);
router.patch('/:id/toggle-active', csrfProtection, toggleRepresentativeStatus);
router.patch('/:id/status', csrfProtection, toggleRepresentativeStatus);
router.delete('/:id', csrfProtection, deleteRepresentative);

export default router;

