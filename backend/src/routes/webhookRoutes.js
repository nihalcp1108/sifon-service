import { Router } from 'express';
import { verifyWebhook, receiveWebhook } from '../controllers/webhookController.js';

const router = Router();

// Handshake verification
router.get('/whatsapp', verifyWebhook);

// Status update ingestion
router.post('/whatsapp', receiveWebhook);

export default router;

