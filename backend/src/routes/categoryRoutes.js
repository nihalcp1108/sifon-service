import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  getCategoryComplaintsPDF,
} from '../controllers/categoryController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getCategories);
router.post('/', csrfProtection, createCategory);
router.patch('/:id', csrfProtection, updateCategory);
router.patch('/:id/status', csrfProtection, toggleCategoryStatus);
router.get('/:id/complaints/pdf', getCategoryComplaintsPDF);

export default router;

