import { Router } from 'express';
import {
  getBrands,
  createBrand,
  updateBrand,
  toggleBrandStatus,
  getBrandComplaintsPDF,
} from '../controllers/brandController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getBrands);
router.post('/', csrfProtection, createBrand);
router.patch('/:id', csrfProtection, updateBrand);
router.patch('/:id/status', csrfProtection, toggleBrandStatus);
router.get('/:id/complaints/pdf', getBrandComplaintsPDF);

export default router;

