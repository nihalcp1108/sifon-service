import { Router } from 'express';
import {
  getComplaints,
  createComplaint,
  getComplaintById,
  updateComplaint,
  updateComplaintStatus,
  updateComplaintAssignment,
  addComplaintNote,
  uploadAttachments,
  downloadAttachment,
  deleteAttachment,
  getIndividualComplaintPDF,
  exportComplaintsPDF,
  archiveComplaint,
  restoreComplaint,
  getComplaintWhatsAppLink,
  completeComplaintService,
} from '../controllers/complaintController.js';
import { retryNotification } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { csrfProtection } from '../middleware/csrfMiddleware.js';
import { upload, verifyUploadedFiles } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(requireAuth);

// List & Create
router.get('/', getComplaints);
router.post(
  '/',
  csrfProtection,
  upload.array('attachments', 10),
  verifyUploadedFiles,
  createComplaint
);

// PDF Export of all or filtered complaints (REGISTERED BEFORE /:id)
router.get('/export/pdf', exportComplaintsPDF);

// WhatsApp Click-to-Chat (REGISTERED BEFORE /:id to guarantee exact route matching)
router.get('/:id/whatsapp-link', getComplaintWhatsAppLink);

// Details by ID
router.get('/:id', getComplaintById);

// Update fields & lifecycle
router.patch('/:id', csrfProtection, updateComplaint);
router.patch('/:id/status', csrfProtection, updateComplaintStatus);
router.patch('/:id/assignment', csrfProtection, updateComplaintAssignment);
router.post('/:id/complete-service', csrfProtection, completeComplaintService);

// Internal notes
router.post('/:id/notes', csrfProtection, addComplaintNote);

// WhatsApp Retry
router.post('/:id/notifications/whatsapp/retry', csrfProtection, retryNotification);

// Attachments
router.post(
  '/:id/attachments',
  csrfProtection,
  upload.array('attachments', 10),
  verifyUploadedFiles,
  uploadAttachments
);
router.get('/:id/attachments/:attachmentId/download', downloadAttachment);
router.delete('/:id/attachments/:attachmentId', csrfProtection, deleteAttachment);

// Individual PDF
router.get('/:id/pdf', getIndividualComplaintPDF);

// Archive & Restore
router.patch('/:id/archive', csrfProtection, archiveComplaint);
router.patch('/:id/restore', csrfProtection, restoreComplaint);

export default router;
