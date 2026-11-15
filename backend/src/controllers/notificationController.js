import { getNotificationSettings } from '../models/NotificationSettings.js';
import {
  retryComplaintWhatsAppNotification,
  verifyWhatsAppProviderConnection,
  buildWhatsAppClickToChatUrl,
  maskPhoneNumber,
} from '../services/whatsappService.js';
import { config } from '../config/env.js';

export async function getSettings(req, res, next) {
  try {
    const settings = await getNotificationSettings();
    const isClickToChatActive = settings.clickToChatEnabled !== false;

    // Return template settings and Click-to-Chat readiness (NO META API CREDENTIALS REQUIRED)
    res.json({
      success: true,
      data: {
        clickToChatEnabled: isClickToChatActive,
        enabled: isClickToChatActive,
        mode: 'manual_click_to_chat',
        companyName: settings.companyName || 'sifon-service',
        customMessageDraft: settings.customMessageDraft || '',
        templateParameters: settings.templateParameters || [],
        testRecipientPhone: settings.testRecipientPhone || '',
        templateName: settings.templateName || 'sifon_complaint_confirmation',
        templateLanguage: settings.templateLanguage || 'en_US',
        serverSenderConfigured: Boolean(config.whatsapp.senderNumber),
        maskedSenderNumber: config.whatsapp.senderNumber ? maskPhoneNumber(config.whatsapp.senderNumber) : '',
        providerConnection: {
          status: isClickToChatActive ? 'Ready (Click-to-Chat)' : 'Disabled',
          isConfigured: true,
          message: isClickToChatActive
            ? 'Direct Click-to-Chat active. Opens customer chat in WhatsApp without requiring Meta Cloud API credentials.'
            : 'WhatsApp click-to-chat is currently disabled in Administrator Settings.',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const {
      enabled,
      clickToChatEnabled,
      templateName,
      templateLanguage,
      companyName,
      customMessageDraft,
      templateParameters,
      testRecipientPhone,
      businessPhoneNumber,
      senderPhoneNumber,
      clearPhoneNumber,
    } = req.body;

    if (businessPhoneNumber !== undefined || senderPhoneNumber !== undefined || clearPhoneNumber !== undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SENDER_MANAGED_BY_ENVIRONMENT',
          message: 'The WhatsApp business sender number is configured exclusively via backend environment variables (WHATSAPP_SENDER_NUMBER). It cannot be modified through the API.',
        },
      });
    }

    const settings = await getNotificationSettings();

    const isExplicitlyEnabled = clickToChatEnabled !== undefined
      ? Boolean(clickToChatEnabled)
      : (enabled !== undefined ? Boolean(enabled) : undefined);

    if (isExplicitlyEnabled !== undefined) {
      settings.clickToChatEnabled = isExplicitlyEnabled;
      settings.enabled = isExplicitlyEnabled;
    }

    if (templateName !== undefined) settings.templateName = String(templateName).trim();
    if (templateLanguage !== undefined) settings.templateLanguage = String(templateLanguage).trim();
    if (companyName !== undefined) settings.companyName = String(companyName).trim();
    if (customMessageDraft !== undefined) settings.customMessageDraft = String(customMessageDraft);
    if (Array.isArray(templateParameters)) {
      settings.templateParameters = templateParameters.map(p => String(p).trim()).filter(Boolean);
    }
    if (testRecipientPhone !== undefined) settings.testRecipientPhone = String(testRecipientPhone).trim();

    settings.updatedBy = req.admin._id;
    await settings.save();

    const isClickToChatActive = settings.clickToChatEnabled !== false;

    res.json({
      success: true,
      message: 'WhatsApp template settings saved successfully',
      data: {
        clickToChatEnabled: isClickToChatActive,
        enabled: isClickToChatActive,
        mode: 'manual_click_to_chat',
        companyName: settings.companyName,
        customMessageDraft: settings.customMessageDraft,
        templateParameters: settings.templateParameters,
        testRecipientPhone: settings.testRecipientPhone,
        templateName: settings.templateName,
        templateLanguage: settings.templateLanguage,
        serverSenderConfigured: Boolean(config.whatsapp.senderNumber),
        maskedSenderNumber: config.whatsapp.senderNumber ? maskPhoneNumber(config.whatsapp.senderNumber) : '',
        providerConnection: {
          status: isClickToChatActive ? 'Ready (Click-to-Chat)' : 'Disabled',
          isConfigured: true,
          message: isClickToChatActive
            ? 'Direct Click-to-Chat active. Opens customer chat in WhatsApp without requiring Meta Cloud API credentials.'
            : 'WhatsApp click-to-chat is currently disabled in Administrator Settings.',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function checkProviderStatus(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        mode: 'manual_click_to_chat',
        status: 'Ready (Click-to-Chat)',
        isConfigured: true,
        message: 'Direct Click-to-Chat active. Opens customer chat in WhatsApp without requiring Meta Cloud API credentials.',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function sendTestMessage(req, res, next) {
  try {
    const { testRecipientPhone } = req.body;
    if (!testRecipientPhone || String(testRecipientPhone).trim().length < 7) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Please provide a valid test recipient phone number with country code.',
        },
      });
    }

    const settings = await getNotificationSettings();
    settings.testRecipientPhone = String(testRecipientPhone).trim();
    await settings.save();

    const sampleComplaint = {
      complaintNumber: 'SIF-2026/001',
      customerName: 'Sample Customer',
      customerPhone: testRecipientPhone,
      brandNameSnapshot: 'Sample Brand',
      categoryNameSnapshot: 'Water Purifier',
      productName: '10L RO Water Purifier',
      servicerNameSnapshot: 'Suresh Kumar',
      status: 'Registered',
      complaintDate: new Date(),
    };

    const linkData = buildWhatsAppClickToChatUrl(
      testRecipientPhone,
      settings.customMessageDraft,
      sampleComplaint,
      settings.companyName,
      '+91',
      true
    );

    res.json({
      success: true,
      message: linkData.isValid
        ? 'Click-to-Chat WhatsApp link generated successfully!'
        : (linkData.error || 'Enter a valid customer WhatsApp number with country code.'),
      data: linkData,
    });
  } catch (err) {
    next(err);
  }
}

export async function retryNotification(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await retryComplaintWhatsAppNotification(id, req.admin._id);

    res.json({
      success: true,
      message: 'WhatsApp notification re-queued successfully',
      data: notification,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'RETRY_REJECTED',
        message: err.message,
      },
    });
  }
}
