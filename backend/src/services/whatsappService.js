import crypto from 'crypto';
import { config } from '../config/env.js';
import { WhatsAppNotification } from '../models/WhatsAppNotification.js';
import { Complaint } from '../models/Complaint.js';
import { getNotificationSettings } from '../models/NotificationSettings.js';
import { formatKolkataDateTime } from './pdfService.js';
import { validateAndFormatCustomerPhone, cleanDuplicateCountryCode } from '../utils/phoneValidator.js';

let outboxWorkerInterval = null;
let isWorkerRunning = false;

/**
 * Normalizes phone numbers to standard E.164 digits without spaces, hyphens, brackets, or leading +.
 */
export function normalizePhoneNumber(phone = '', defaultCountryCode = '91') {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/^\++/, '');
  }

  // If 10 digits (e.g. standard Indian mobile numbers without country code)
  if (cleaned.length === 10) {
    return `${defaultCountryCode.replace(/^\++/, '')}${cleaned}`;
  }

  return cleaned;
}

/**
 * Masks a phone number for safe display without exposing full digits.
 * e.g. "+91 99951 91108" -> "+91 99951 •••• 08"
 */
export function maskPhoneNumber(phone = '') {
  if (!phone) return '';
  const str = String(phone).trim();
  if (str.length <= 6) return '••••••';
  const startLen = Math.min(9, Math.max(6, str.length - 5));
  const start = str.slice(0, startLen);
  const end = str.slice(-2);
  return `${start} •••• ${end}`;
}

/**
 * Resolves all 9 supported complaint placeholders to concrete string values.
 */
export function resolveTemplateVariables(complaint = {}, companyName = 'sifon-service') {
  return {
    customer_name: complaint.customerName || 'Customer',
    complaint_id: complaint.complaintNumber || 'N/A',
    brand_name: complaint.brand?.name || complaint.brandNameSnapshot || 'Not assigned',
    category_name: complaint.category?.name || complaint.categoryNameSnapshot || 'Not assigned',
    product_name: complaint.productName || 'N/A',
    servicer_name: complaint.assignedServicer?.name || complaint.servicerNameSnapshot || 'Unassigned',
    status: complaint.status || 'Registered',
    registered_date: formatKolkataDateTime(complaint.complaintDate || new Date()),
    company_name: companyName || 'sifon-service',
  };
}

/**
 * Builds Meta WhatsApp Cloud API body component parameters array based on configured parameter names.
 */
export function buildTemplateParameters(paramKeys = [], complaint = {}, companyName = 'sifon-service') {
  const vars = resolveTemplateVariables(complaint, companyName);

  const keysToUse = Array.isArray(paramKeys) && paramKeys.length > 0
    ? paramKeys
    : [
        'customer_name',
        'complaint_id',
        'brand_name',
        'category_name',
        'product_name',
        'servicer_name',
        'status',
        'registered_date',
        'company_name',
      ];

  return keysToUse.map((key) => ({
    type: 'text',
    text: String(vars[key] || 'N/A'),
  }));
}

/**
 * Replaces placeholders in notification template string with complaint data for live preview or logs.
 * Never outputs 'undefined' for missing optional values.
 */
export function renderTemplateText(templateDraft = '', complaint = {}, companyName = 'sifon-service') {
  const defaultTemplate =
    templateDraft ||
    'Hello {{customer_name}}, your complaint #{{complaint_id}} for {{brand_name}} {{product_name}} has been registered with {{company_name}}. Current status: {{status}}.';

  const values = resolveTemplateVariables(complaint, companyName);
  let rendered = defaultTemplate;
  for (const [key, val] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.split(placeholder).join(val !== undefined && val !== null && val !== '' ? String(val) : 'N/A');
  }

  // Ensure any unmatched or unknown {{placeholder}} is cleanly replaced with 'N/A' rather than 'undefined'
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, 'N/A');

  return rendered;
}

/**
 * Formats international phone number for WhatsApp wa.me links using libphonenumber parser.
 * Returns only digits, e.g. "919876543210".
 */
export function formatInternationalPhone(phone = '', defaultCountryCode = '91') {
  if (!phone) return '';
  const result = validateAndFormatCustomerPhone(phone, defaultCountryCode);
  if (result.isValid && result.internationalDigits) {
    return result.internationalDigits;
  }
  // Fallback to cleaned digits if parser couldn't validate but digits exist
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.replace(/^00+/, '');
  if (digits.startsWith('0') && digits.length > 10) digits = digits.replace(/^0+/, '');
  if (digits.length === 10 && defaultCountryCode) {
    digits = `${String(defaultCountryCode).replace(/\D/g, '')}${digits}`;
  }
  return digits;
}

/**
 * Validates international digits for WhatsApp using libphonenumber parser.
 */
export function isValidInternationalPhone(phoneDigits = '', defaultCountryCode = '91') {
  if (!phoneDigits) return false;
  const result = validateAndFormatCustomerPhone(phoneDigits, defaultCountryCode);
  return result.isValid;
}

/**
 * Builds the official WhatsApp Click-to-Chat URL:
 * https://wa.me/{internationalDigitsOnly}?text={encodedMessage}
 *
 * Distinct error reasons:
 * - 'DISABLED' -> 'Enable WhatsApp click-to-chat in Account Settings.'
 * - 'INVALID_PHONE' -> 'Enter a valid customer WhatsApp number with country code.'
 */
export function buildWhatsAppClickToChatUrl(
  phone,
  templateDraft = '',
  complaint = {},
  companyName = 'sifon-service',
  defaultCountryCode = '+91',
  isClickToChatEnabled = true
) {
  if (isClickToChatEnabled === false) {
    return {
      url: '',
      internationalDigits: '',
      formattedPhone: '',
      rawPhone: phone,
      isValid: false,
      reason: 'DISABLED',
      error: 'Enable WhatsApp click-to-chat in Account Settings.',
      renderedMessage: '',
      encodedMessage: '',
    };
  }

  const phoneValidation = validateAndFormatCustomerPhone(phone, defaultCountryCode);
  if (!phoneValidation.isValid) {
    return {
      url: '',
      internationalDigits: '',
      formattedPhone: '',
      rawPhone: phone,
      isValid: false,
      reason: 'INVALID_PHONE',
      error: phoneValidation.error || 'Enter a valid customer WhatsApp number with country code.',
      renderedMessage: '',
      encodedMessage: '',
    };
  }

  const defaultTemplate =
    templateDraft ||
    'Hello {{customer_name}}, your complaint #{{complaint_id}} for {{brand_name}} {{product_name}} has been registered with {{company_name}}. Current status: {{status}}.';

  const renderedMessage = renderTemplateText(defaultTemplate, complaint, companyName);
  const encodedMessage = encodeURIComponent(renderedMessage);

  return {
    url: `https://wa.me/${phoneValidation.internationalDigits}?text=${encodedMessage}`,
    internationalDigits: phoneValidation.internationalDigits,
    formattedPhone: phoneValidation.formatted,
    rawPhone: phone,
    isValid: true,
    reason: null,
    error: null,
    renderedMessage,
    encodedMessage,
  };
}

/**
 * Verifies live connection with Meta WhatsApp Business Cloud API.
 * Validates Phone Number ID, Access Token, and checks if server environment WHATSAPP_SENDER_NUMBER matches Meta's registered number.
 * Returns one of the 4 exact statuses: 'Not configured', 'Setup required', 'Ready', or 'Connection error'.
 */
export async function verifyWhatsAppProviderConnection(overrideSenderNumber = null) {
  const { senderNumber: envSender, phoneNumberId, accessToken, apiVersion, webhookVerifyToken, appSecret } = config.whatsapp;
  const effectiveSender = overrideSenderNumber !== null ? overrideSenderNumber : envSender;

  const webhookStatus = {
    isReady: Boolean(webhookVerifyToken && appSecret),
    verifyTokenConfigured: Boolean(webhookVerifyToken),
    appSecretConfigured: Boolean(appSecret),
    message: (webhookVerifyToken && appSecret)
      ? 'Webhook verify token and app secret are configured.'
      : 'Webhook configuration incomplete: Configure WHATSAPP_WEBHOOK_VERIFY_TOKEN and WHATSAPP_APP_SECRET in backend/.env for real-time delivery receipts.',
  };

  if (!phoneNumberId && !accessToken && !effectiveSender) {
    return {
      isConfigured: false,
      status: 'Not configured',
      message: 'WhatsApp Business API is not configured. Server environment variables (WHATSAPP_SENDER_NUMBER, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN) are missing.',
      providerNumber: null,
      verifiedName: null,
      qualityRating: 'UNKNOWN',
      matched: false,
      configuredSender: null,
      webhookStatus,
    };
  }

  if (!phoneNumberId || !accessToken) {
    const missing = [];
    if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');

    return {
      isConfigured: false,
      status: 'Not configured',
      message: `WhatsApp API credentials (${missing.join(' or ')}) are missing in server environment (.env).`,
      providerNumber: null,
      verifiedName: null,
      qualityRating: 'UNKNOWN',
      matched: false,
      configuredSender: effectiveSender ? maskPhoneNumber(effectiveSender) : null,
      webhookStatus,
    };
  }

  try {
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          isConfigured: true,
          status: 'Connection error',
          message: 'Provider authentication failure: The configured WHATSAPP_ACCESS_TOKEN was rejected by Meta (Invalid, expired, or insufficient permissions).',
          providerNumber: null,
          verifiedName: null,
          qualityRating: 'UNKNOWN',
          matched: false,
          configuredSender: effectiveSender ? maskPhoneNumber(effectiveSender) : null,
          webhookStatus,
        };
      }

      const errMsg = data.error?.message || `Meta Graph API error (HTTP ${res.status})`;
      return {
        isConfigured: true,
        status: 'Connection error',
        message: errMsg,
        providerNumber: null,
        verifiedName: null,
        qualityRating: 'UNKNOWN',
        matched: false,
        configuredSender: effectiveSender ? maskPhoneNumber(effectiveSender) : null,
        webhookStatus,
      };
    }

    const providerDisplayNumber = data.display_phone_number || '';
    const normalizedProvider = normalizePhoneNumber(providerDisplayNumber);
    const normalizedConfigured = normalizePhoneNumber(effectiveSender);

    if (!effectiveSender || !normalizedConfigured) {
      return {
        isConfigured: false,
        status: 'Setup required',
        message: `Meta Phone Number ID is verified with Meta (registered number: ${providerDisplayNumber}), but WHATSAPP_SENDER_NUMBER is missing in server environment (.env).`,
        providerNumber: providerDisplayNumber,
        verifiedName: data.verified_name || '',
        matched: false,
        qualityRating: data.quality_rating || 'UNKNOWN',
        configuredSender: null,
        webhookStatus,
      };
    }

    if (normalizedProvider === normalizedConfigured) {
      return {
        isConfigured: true,
        status: 'Ready',
        message: `Sender number verified and ready to dispatch customer notifications via Meta WhatsApp Business Cloud API (${data.verified_name || 'Verified'}).`,
        providerNumber: providerDisplayNumber,
        verifiedName: data.verified_name || '',
        matched: true,
        qualityRating: data.quality_rating || 'UNKNOWN',
        configuredSender: maskPhoneNumber(effectiveSender),
        webhookStatus,
      };
    }

    return {
      isConfigured: true,
      status: 'Setup required',
      message: `Sender mismatch: The environment WHATSAPP_SENDER_NUMBER (${effectiveSender}) does not match the provider registered number (${providerDisplayNumber}) for Phone Number ID ${phoneNumberId}. Update WHATSAPP_SENDER_NUMBER in backend/.env.`,
      providerNumber: providerDisplayNumber,
      verifiedName: data.verified_name || '',
      matched: false,
      qualityRating: data.quality_rating || 'UNKNOWN',
      configuredSender: maskPhoneNumber(effectiveSender),
      webhookStatus,
    };
  } catch (err) {
    return {
      isConfigured: true,
      status: 'Connection error',
      message: `Failed to connect to Meta Graph API: ${err.message}`,
      providerNumber: null,
      verifiedName: null,
      qualityRating: 'UNKNOWN',
      matched: false,
      configuredSender: effectiveSender ? maskPhoneNumber(effectiveSender) : null,
      webhookStatus,
    };
  }
}

/**
 * Sends a test WhatsApp template message to an explicitly provided consenting recipient.
 */
export async function sendTestWhatsAppMessage(testRecipientPhone, adminId) {
  const { phoneNumberId, accessToken, senderNumber, apiVersion } = config.whatsapp;

  const missing = [];
  if (!senderNumber) missing.push('WHATSAPP_SENDER_NUMBER');
  if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');

  if (missing.length > 0) {
    throw new Error(`WhatsApp API credentials (${missing.join(', ')}) are missing in server environment (.env).`);
  }

  const normalizedRecipient = normalizePhoneNumber(testRecipientPhone);
  if (!normalizedRecipient || normalizedRecipient.length < 8) {
    throw new Error('Please enter a valid test recipient phone number with country code (e.g. 919876543210 or +91 9876543210).');
  }

  const connection = await verifyWhatsAppProviderConnection();
  if (connection.status !== 'Ready') {
    throw new Error(`Sender is not ready (${connection.status}: ${connection.message}). Configure WHATSAPP_SENDER_NUMBER and credentials in backend/.env and restart the server.`);
  }

  const settings = await getNotificationSettings();

  // Save the tested recipient number for convenience
  settings.testRecipientPhone = testRecipientPhone;
  await settings.save();

  // Construct mock complaint for test rendering
  const testComplaint = {
    complaintNumber: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
    customerName: 'Test Recipient',
    customerPhone: normalizedRecipient,
    brandNameSnapshot: 'Sample Brand',
    categoryNameSnapshot: 'Appliances',
    productName: 'Sample Product',
    servicerNameSnapshot: 'Sample Servicer',
    status: 'Registered',
    complaintDate: new Date(),
  };

  const parameters = buildTemplateParameters(settings.templateParameters, testComplaint, settings.companyName);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedRecipient,
    type: 'template',
    template: {
      name: settings.templateName,
      language: { code: settings.templateLanguage || 'en_US' },
      components: [
        {
          type: 'body',
          parameters,
        },
      ],
    },
  };

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  const responseBody = await response.json();

  if (response.ok && responseBody.messages?.[0]?.id) {
    return {
      success: true,
      messageId: responseBody.messages[0].id,
      recipient: normalizedRecipient,
      provider: 'WhatsApp Business Cloud API',
    };
  }

  const errorObj = responseBody.error || {};
  let failureMessage = errorObj.message || 'Meta rejected test message request';

  // Provide clear guidance on common Meta sandbox restriction (code 131030)
  if (errorObj.code === 131030) {
    failureMessage = `Meta Sandbox Restriction: Recipient phone number (${normalizedRecipient}) is not in your allowed test recipients list. In Meta Developer App Dashboard, go to WhatsApp > API Setup and add this number to the "To" phone number list.`;
  } else if (errorObj.code === 132001) {
    failureMessage = `Template Not Found: The template "${settings.templateName}" in language "${settings.templateLanguage}" was not found or is not yet approved in your WhatsApp Business Manager.`;
  }

  const err = new Error(failureMessage);
  err.metaCode = errorObj.code;
  err.metaDetails = errorObj;
  throw err;
}

/**
 * Queues a WhatsApp confirmation notification into the durable outbox.
 * Checks whether notifications are enabled in MongoDB settings.
 * Prevents duplicate queueing for repeated submissions.
 */
export async function queueWhatsAppNotification(complaint, adminId, destinationPhone) {
  const settings = await getNotificationSettings();

  if (!settings.enabled) {
    return null;
  }

  const normalized = normalizePhoneNumber(destinationPhone || complaint.customerPhone);
  if (!normalized) {
    return null;
  }

  // Prevent duplicate notifications from repeated submissions
  const existing = await WhatsAppNotification.findOne({
    complaintId: complaint._id,
    status: { $in: ['Queued', 'Processing', 'Accepted by provider', 'Delivered'] },
  });

  if (existing) {
    return existing;
  }

  const renderedMessage = renderTemplateText(settings.customMessageDraft, complaint, settings.companyName);

  const notification = await WhatsAppNotification.create({
    complaintId: complaint._id,
    complaintNumber: complaint.complaintNumber,
    destinationPhone: normalized,
    consent: {
      agreed: true,
      timestamp: new Date(),
      adminId,
    },
    templateName: settings.templateName,
    templateLanguage: settings.templateLanguage,
    renderedMessage,
    status: 'Queued',
  });

  // Update complaint reference
  await Complaint.findByIdAndUpdate(complaint._id, {
    'whatsappNotification.requested': true,
    'whatsappNotification.destinationPhone': normalized,
    'whatsappNotification.status': 'Queued',
    'whatsappNotification.notificationId': notification._id,
    'whatsappNotification.error': '',
    'whatsappNotification.lastUpdated': new Date(),
  });

  // Trigger processing asynchronously in background
  setImmediate(() => {
    processWhatsAppOutbox().catch((err) => console.error('[WhatsApp Outbox Error]', err));
  });

  return notification;
}

/**
 * Processes queued notifications through the WhatsApp Business Cloud API.
 * Uses atomic findOneAndUpdate for worker locking to prevent concurrent double-sends.
 */
export async function processWhatsAppOutbox() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    const pending = await WhatsAppNotification.find({ status: 'Queued' }).limit(10);
    if (pending.length === 0) return;

    const settings = await getNotificationSettings();
    const isConfigured = Boolean(config.whatsapp.phoneNumberId && config.whatsapp.accessToken);

    for (const item of pending) {
      // Atomically transition from Queued to Processing
      const locked = await WhatsAppNotification.findOneAndUpdate(
        { _id: item._id, status: 'Queued' },
        { status: 'Processing', lastAttemptAt: new Date(), $inc: { attemptCount: 1 } },
        { new: true }
      );
      if (!locked) continue;

      if (!settings.enabled) {
        const reason = 'WhatsApp notifications are disabled in Account Settings.';
        await WhatsAppNotification.findByIdAndUpdate(locked._id, {
          status: 'Failed',
          errorDetails: reason,
        });

        await Complaint.findByIdAndUpdate(locked.complaintId, {
          'whatsappNotification.status': 'Failed',
          'whatsappNotification.error': reason,
          'whatsappNotification.lastUpdated': new Date(),
        });
        continue;
      }

      const { phoneNumberId, accessToken, senderNumber } = config.whatsapp;
      const isConfigured = Boolean(phoneNumberId && accessToken && senderNumber);

      if (!isConfigured) {
        const missing = [];
        if (!senderNumber) missing.push('WHATSAPP_SENDER_NUMBER');
        if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
        if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
        const reason = `WhatsApp API credentials (${missing.join(', ')}) are missing in server environment (.env).`;

        await WhatsAppNotification.findByIdAndUpdate(locked._id, {
          status: 'Failed',
          errorDetails: reason,
        });

        await Complaint.findByIdAndUpdate(locked.complaintId, {
          'whatsappNotification.status': 'Failed',
          'whatsappNotification.error': reason,
          'whatsappNotification.lastUpdated': new Date(),
        });
        continue;
      }

      // Validate live provider connection and sender match
      const connection = await verifyWhatsAppProviderConnection();
      if (connection.status !== 'Ready') {
        const reason = `WhatsApp sender is not ready (${connection.status}: ${connection.message}). Please verify server environment configuration.`;

        await WhatsAppNotification.findByIdAndUpdate(locked._id, {
          status: 'Failed',
          errorDetails: reason,
        });

        await Complaint.findByIdAndUpdate(locked.complaintId, {
          'whatsappNotification.status': 'Failed',
          'whatsappNotification.error': reason,
          'whatsappNotification.lastUpdated': new Date(),
        });
        continue;
      }

      // Populate complaint for full template parameters
      const complaintDoc = await Complaint.findById(locked.complaintId)
        .populate('brand category assignedServicer')
        .lean();

      const complaintData = complaintDoc || {
        complaintNumber: locked.complaintNumber,
        customerName: 'Customer',
        customerPhone: locked.destinationPhone,
        status: 'Registered',
        complaintDate: locked.createdAt,
      };

      const parameters = buildTemplateParameters(
        settings.templateParameters,
        complaintData,
        settings.companyName
      );

      try {
        const url = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: locked.destinationPhone,
          type: 'template',
          template: {
            name: locked.templateName || settings.templateName,
            language: { code: locked.templateLanguage || settings.templateLanguage },
            components: [
              {
                type: 'body',
                parameters,
              },
            ],
          },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.whatsapp.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000), // 15s timeout
        });

        const responseBody = await response.json();

        if (response.ok && responseBody.messages?.[0]?.id) {
          const msgId = responseBody.messages[0].id;
          await WhatsAppNotification.findByIdAndUpdate(locked._id, {
            status: 'Accepted by provider',
            providerMessageId: msgId,
            errorDetails: '',
          });

          await Complaint.findByIdAndUpdate(locked.complaintId, {
            'whatsappNotification.status': 'Accepted by provider',
            'whatsappNotification.providerMessageId': msgId,
            'whatsappNotification.error': '',
            'whatsappNotification.lastUpdated': new Date(),
          });
        } else {
          const errMsg = responseBody.error?.message || 'Provider rejected notification request';
          await WhatsAppNotification.findByIdAndUpdate(locked._id, {
            status: 'Failed',
            errorDetails: errMsg,
          });

          await Complaint.findByIdAndUpdate(locked.complaintId, {
            'whatsappNotification.status': 'Failed',
            'whatsappNotification.error': errMsg,
            'whatsappNotification.lastUpdated': new Date(),
          });
        }
      } catch (err) {
        // Distinguish ambiguous timeout from definitive rejection
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        const finalStatus = isTimeout ? 'Unknown' : 'Failed';
        const details = isTimeout
          ? 'Request timed out waiting for provider response. Ambiguous timeout prevents certainty.'
          : err.message;

        await WhatsAppNotification.findByIdAndUpdate(locked._id, {
          status: finalStatus,
          errorDetails: details,
        });

        await Complaint.findByIdAndUpdate(locked.complaintId, {
          'whatsappNotification.status': finalStatus,
          'whatsappNotification.error': details,
          'whatsappNotification.lastUpdated': new Date(),
        });
      }
    }
  } catch (outboxErr) {
    console.error('[WhatsApp Outbox Processor Exception]', outboxErr.message);
  } finally {
    isWorkerRunning = false;
  }
}

/**
 * Starts the periodic outbox background worker.
 */
export function startWhatsAppOutboxWorker(intervalMs = 15000) {
  if (outboxWorkerInterval) return;
  outboxWorkerInterval = setInterval(() => {
    processWhatsAppOutbox().catch((err) => console.error('[WhatsApp Outbox Worker Error]', err));
  }, intervalMs);
  outboxWorkerInterval.unref(); // Do not block process exit
}

/**
 * Stops the periodic outbox background worker.
 */
export function stopWhatsAppOutboxWorker() {
  if (outboxWorkerInterval) {
    clearInterval(outboxWorkerInterval);
    outboxWorkerInterval = null;
  }
}

/**
 * Controlled retry of failed WhatsApp notification for a complaint.
 * Protects against duplicate sending if already accepted or delivered.
 */
export async function retryComplaintWhatsAppNotification(complaintId, adminId) {
  const complaint = await Complaint.findById(complaintId).populate('brand category assignedServicer');
  if (!complaint) {
    throw new Error('Complaint not found');
  }

  // Find latest existing notification
  let notification = await WhatsAppNotification.findOne({ complaintId }).sort({ createdAt: -1 });

  // Guard against duplicate retries for already accepted/delivered notifications
  if (notification) {
    if (['Accepted by provider', 'Delivered', 'Read'].includes(notification.status)) {
      throw new Error('Notification has already been accepted or delivered. To prevent duplicate messages, only failed notifications can be retried.');
    }
    if (notification.status === 'Processing') {
      throw new Error('Notification is currently being processed by the outbox worker. Please wait a moment.');
    }
  }

  const settings = await getNotificationSettings();
  const renderedMessage = renderTemplateText(settings.customMessageDraft, complaint, settings.companyName);

  if (notification) {
    notification.status = 'Queued';
    notification.renderedMessage = renderedMessage;
    notification.errorDetails = '';
    await notification.save();
  } else {
    notification = await WhatsAppNotification.create({
      complaintId: complaint._id,
      complaintNumber: complaint.complaintNumber,
      destinationPhone: normalizePhoneNumber(complaint.customerPhone),
      consent: { agreed: true, timestamp: new Date(), adminId },
      templateName: settings.templateName,
      templateLanguage: settings.templateLanguage,
      renderedMessage,
      status: 'Queued',
    });
  }

  await Complaint.findByIdAndUpdate(complaintId, {
    'whatsappNotification.requested': true,
    'whatsappNotification.status': 'Queued',
    'whatsappNotification.error': '',
    'whatsappNotification.notificationId': notification._id,
    'whatsappNotification.lastUpdated': new Date(),
  });

  // Process outbox immediately
  setImmediate(() => {
    processWhatsAppOutbox().catch(() => {});
  });

  return notification;
}

/**
 * Validates Meta Webhook signature.
 */
export function verifyWebhookSignature(rawBody, signatureHeader, appSecret = config.whatsapp.appSecret) {
  if (!appSecret || !signatureHeader) return false;

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

/**
 * Handles incoming Meta WhatsApp Webhook event payload safely.
 * Handles duplicate delivery events and prevents status regression.
 */
export async function handleWebhookEvent(event) {
  if (event.object !== 'whatsapp_business_account') return;

  const entries = event.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field === 'messages' && change.value) {
        const statuses = change.value.statuses || [];
        for (const statusObj of statuses) {
          const providerId = statusObj.id;
          const statusStr = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
          const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

          const existingNotification = await WhatsAppNotification.findOne({ providerMessageId: providerId });
          if (!existingNotification) continue;

          // Prevent status regression (e.g. 'sent' arriving after 'delivered' or 'read')
          if (statusStr === 'sent' && ['Delivered', 'Read'].includes(existingNotification.status)) {
            continue;
          }
          if (statusStr === 'delivered' && existingNotification.status === 'Read') {
            continue;
          }

          let mappedStatus = existingNotification.status;
          const updateFields = {};

          if (statusStr === 'sent') {
            mappedStatus = 'Accepted by provider';
          } else if (statusStr === 'delivered') {
            mappedStatus = 'Delivered';
            updateFields.deliveredAt = timestamp;
          } else if (statusStr === 'read') {
            mappedStatus = 'Read';
            updateFields.readAt = timestamp;
          } else if (statusStr === 'failed') {
            mappedStatus = 'Failed';
            const errors = statusObj.errors?.[0];
            updateFields.errorDetails = errors ? `${errors.title || ''}: ${errors.message || ''}` : 'Message delivery failed';
          }

          updateFields.status = mappedStatus;

          const updated = await WhatsAppNotification.findByIdAndUpdate(
            existingNotification._id,
            updateFields,
            { new: true }
          );

          if (updated) {
            await Complaint.findByIdAndUpdate(updated.complaintId, {
              'whatsappNotification.status': mappedStatus,
              'whatsappNotification.lastUpdated': timestamp,
              ...(updateFields.errorDetails ? { 'whatsappNotification.error': updateFields.errorDetails } : {}),
            });
          }
        }
      }
    }
  }
}
