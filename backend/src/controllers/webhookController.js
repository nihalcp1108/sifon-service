import { config } from '../config/env.js';
import { verifyWebhookSignature, handleWebhookEvent } from '../services/whatsappService.js';

export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
    console.log('[WhatsApp Webhook] Handshake verified successfully.');
    return res.status(200).send(challenge);
  }

  return res.status(403).json({
    success: false,
    error: { code: 'INVALID_VERIFY_TOKEN', message: 'Webhook verification token mismatch' },
  });
}

export async function receiveWebhook(req, res) {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (config.whatsapp.appSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, config.whatsapp.appSecret);
      if (!isValid) {
        console.warn('[WhatsApp Webhook] Signature verification failed');
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature is invalid' },
        });
      }
    }

    await handleWebhookEvent(req.body);

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[WhatsApp Webhook Error]', err);
    // Always return 200 to WhatsApp to avoid repeated retry storms
    return res.status(200).json({ status: 'error_handled' });
  }
}

