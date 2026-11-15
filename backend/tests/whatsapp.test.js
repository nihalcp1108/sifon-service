import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth } from './setup.js';
import { WhatsAppNotification } from '../src/models/WhatsAppNotification.js';
import { Complaint } from '../src/models/Complaint.js';
import { getNotificationSettings } from '../src/models/NotificationSettings.js';
import {
  normalizePhoneNumber,
  resolveTemplateVariables,
  buildTemplateParameters,
  renderTemplateText,
  verifyWhatsAppProviderConnection,
  processWhatsAppOutbox,
  formatInternationalPhone,
  isValidInternationalPhone,
  buildWhatsAppClickToChatUrl,
} from '../src/services/whatsappService.js';
import { validateAndFormatCustomerPhone, cleanDuplicateCountryCode } from '../src/utils/phoneValidator.js';
import { config } from '../src/config/env.js';

describe('WhatsApp Notifications, Settings, Queueing, Delivery & Verification', () => {
  let app;
  let auth;
  let testComplaintId;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
    auth = await getCsrfAndAuth(request);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('normalizes various phone number formats into E.164 digits', () => {
    assert.equal(normalizePhoneNumber('+91 98765 43210'), '919876543210');
    assert.equal(normalizePhoneNumber('9876543210', '91'), '919876543210');
    assert.equal(normalizePhoneNumber('+1 (555) 123-4567'), '15551234567');
    assert.equal(normalizePhoneNumber('09876543210'), '09876543210');
    assert.equal(normalizePhoneNumber(''), '');
  });

  it('correctly maps all 9 supported template variables', () => {
    const mockComplaint = {
      customerName: 'Ananya Sharma',
      complaintNumber: 'SIF-2026/099',
      brandNameSnapshot: 'Kent RO',
      categoryNameSnapshot: 'Water Purifier',
      productName: 'Grand Plus RO',
      servicerNameSnapshot: 'Vikram Singh',
      status: 'In Progress',
      complaintDate: new Date('2026-03-15T10:30:00.000Z'),
    };

    const vars = resolveTemplateVariables(mockComplaint, 'sifon-service Official');
    assert.equal(vars.customer_name, 'Ananya Sharma');
    assert.equal(vars.complaint_id, 'SIF-2026/099');
    assert.equal(vars.brand_name, 'Kent RO');
    assert.equal(vars.category_name, 'Water Purifier');
    assert.equal(vars.product_name, 'Grand Plus RO');
    assert.equal(vars.servicer_name, 'Vikram Singh');
    assert.equal(vars.status, 'In Progress');
    assert.ok(vars.registered_date);
    assert.equal(vars.company_name, 'sifon-service Official');

    const rendered = renderTemplateText(
      'Hi {{customer_name}}, ticket {{complaint_id}} for {{product_name}} is {{status}} with {{company_name}}.',
      mockComplaint,
      'sifon-service Official'
    );
    assert.equal(
      rendered,
      'Hi Ananya Sharma, ticket SIF-2026/099 for Grand Plus RO is In Progress with sifon-service Official.'
    );

    const params = buildTemplateParameters(
      ['customer_name', 'complaint_id', 'status', 'company_name'],
      mockComplaint,
      'sifon-service Official'
    );
    assert.equal(params.length, 4);
    assert.equal(params[0].text, 'Ananya Sharma');
    assert.equal(params[1].text, 'SIF-2026/099');
    assert.equal(params[2].text, 'In Progress');
    assert.equal(params[3].text, 'sifon-service Official');
  });

  it('fetches notification settings without leaking access tokens or secrets', async () => {
    const res = await request(app)
      .get('/api/settings/notifications')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.enabled, 'boolean');
    assert.equal(typeof res.body.data.templateName, 'string');
    assert.ok(res.body.data.providerConnection);
    // Ensure secrets are never sent to the client
    assert.equal(res.body.data.accessToken, undefined);
    assert.equal(res.body.data.appSecret, undefined);
    assert.equal(res.body.data.webhookVerifyToken, undefined);
  });

  it('updates notification settings safely with CSRF protection and persists in MongoDB without sender phone number', async () => {
    const res = await request(app)
      .patch('/api/settings/notifications')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        enabled: true,
        templateName: 'sifon_complaint_confirmation',
        templateLanguage: 'en_US',
        companyName: 'sifon-service Global',
        customMessageDraft: 'Hi {{customer_name}}, ticket #{{complaint_id}} registered with {{company_name}}.',
        templateParameters: ['customer_name', 'complaint_id', 'company_name'],
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.enabled, true);
    assert.equal(res.body.data.templateName, 'sifon_complaint_confirmation');
    assert.equal(res.body.data.companyName, 'sifon-service Global');
    assert.deepEqual(res.body.data.templateParameters, ['customer_name', 'complaint_id', 'company_name']);

    // Verify settings persist in MongoDB after re-fetching
    const settings = await getNotificationSettings();
    assert.equal(settings.enabled, true);
    assert.equal(settings.companyName, 'sifon-service Global');
  });

  it('rejects attempts to update sender phone number via settings API with SENDER_MANAGED_BY_ENVIRONMENT', async () => {
    const res1 = await request(app)
      .patch('/api/settings/notifications')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({ businessPhoneNumber: '+91 98765 88888' });

    assert.equal(res1.status, 400);
    assert.equal(res1.body.error.code, 'SENDER_MANAGED_BY_ENVIRONMENT');

    const res2 = await request(app)
      .patch('/api/settings/notifications')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({ senderPhoneNumber: '+91 98765 88888' });

    assert.equal(res2.status, 400);
    assert.equal(res2.body.error.code, 'SENDER_MANAGED_BY_ENVIRONMENT');

    const res3 = await request(app)
      .patch('/api/settings/notifications')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({ clearPhoneNumber: true });

    assert.equal(res3.status, 400);
    assert.equal(res3.body.error.code, 'SENDER_MANAGED_BY_ENVIRONMENT');
  });

  it('reads effective sender strictly from backend environment and displays masked sender without leaking credentials', async () => {
    const originalSender = config.whatsapp.senderNumber;
    try {
      config.whatsapp.senderNumber = '+91 99951 91108';

      const res = await request(app)
        .get('/api/settings/notifications')
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.serverSenderConfigured, true);
      assert.ok(res.body.data.maskedSenderNumber.includes('+91 99951'));
      assert.ok(res.body.data.maskedSenderNumber.includes('••••'));
      // Secrets must never be returned
      assert.equal(res.body.data.accessToken, undefined);
      assert.equal(res.body.data.appSecret, undefined);
      assert.equal(res.body.data.webhookVerifyToken, undefined);
    } finally {
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('does not allow old MongoDB database sender value to override environment sender configuration', async () => {
    const originalSender = config.whatsapp.senderNumber;
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalFetch = global.fetch;

    try {
      // 1. Plant an old sender number in MongoDB settings
      const settings = await getNotificationSettings();
      settings.businessPhoneNumber = '+91 11111 22222';
      await settings.save();

      // 2. Set the actual environment configuration
      config.whatsapp.senderNumber = '+91 99951 91108';
      config.whatsapp.phoneNumberId = '10987654321';
      config.whatsapp.accessToken = 'test_token';

      // 3. Mock Meta Graph API returning the registered environment number
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          display_phone_number: '+91 99951 91108',
          verified_name: 'sifon-service Support',
          quality_rating: 'GREEN',
        }),
      });

      // 4. Verify connection check uses environment sender, not MongoDB value
      const check = await verifyWhatsAppProviderConnection();
      assert.equal(check.status, 'Ready');
      assert.equal(check.matched, true);
      assert.ok(check.configuredSender.includes('+91 99951'));
    } finally {
      config.whatsapp.senderNumber = originalSender;
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      global.fetch = originalFetch;
    }
  });

  it('marks outbox notifications failed with "disabled in Account Settings" when enabled is false, distinct from sender verification', async () => {
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalSender = config.whatsapp.senderNumber;

    try {
      config.whatsapp.phoneNumberId = '10987654321';
      config.whatsapp.accessToken = 'valid_token';
      config.whatsapp.senderNumber = '+91 99951 91108';

      // 1. Explicitly disable notifications in DB
      const settings = await getNotificationSettings();
      settings.enabled = false;
      settings.senderStatus = 'Ready';
      await settings.save();

      // 2. Queue a test notification directly in outbox
      const comp = await Complaint.create({
        complaintNumber: 'WA-TEST-DISABLED-CHECK',
        customerName: 'Disabled Check',
        customerPhone: '9876500055',
        countryCode: '+91',
        customerAddress: 'Some Lane',
        area: 'Indiranagar',
        productName: 'Unit',
        subject: 'Disabled Test',
        description: 'Testing disabled notification reason',
        status: 'Registered',
      });

      const notif = await WhatsAppNotification.create({
        complaintId: comp._id,
        complaintNumber: comp.complaintNumber,
        destinationPhone: '919876500055',
        status: 'Queued',
        templateName: 'sifon_complaint_confirmation',
      });

      // 3. Run outbox worker
      await processWhatsAppOutbox();

      // 4. Verify reason specifically cites Account Settings disabled, NOT missing credentials or missing sender
      const updated = await WhatsAppNotification.findById(notif._id);
      assert.equal(updated.status, 'Failed');
      assert.equal(updated.errorDetails, 'WhatsApp notifications are disabled in Account Settings.');
    } finally {
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('reports "Not configured" when backend environment variables are absent', async () => {
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalSender = config.whatsapp.senderNumber;

    try {
      config.whatsapp.phoneNumberId = '';
      config.whatsapp.accessToken = '';
      config.whatsapp.senderNumber = '';

      const check = await verifyWhatsAppProviderConnection();
      assert.equal(check.isConfigured, false);
      assert.equal(check.status, 'Not configured');
      assert.equal(check.matched, false);
      assert.ok(check.message.includes('missing'));
    } finally {
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('reports "Setup required" when credentials exist but WHATSAPP_SENDER_NUMBER is empty', async () => {
    const originalFetch = global.fetch;
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalSender = config.whatsapp.senderNumber;

    try {
      config.whatsapp.phoneNumberId = '10987654321';
      config.whatsapp.accessToken = 'test_valid_access_token';
      config.whatsapp.senderNumber = '';

      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          display_phone_number: '+91 98765 43210',
          verified_name: 'sifon-service Support',
          quality_rating: 'GREEN',
        }),
      });

      const check = await verifyWhatsAppProviderConnection();
      assert.equal(check.isConfigured, false);
      assert.equal(check.status, 'Setup required');
      assert.equal(check.matched, false);
      assert.ok(check.message.includes('WHATSAPP_SENDER_NUMBER is missing'));
    } finally {
      global.fetch = originalFetch;
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('reports "Setup required" when WHATSAPP_SENDER_NUMBER does not match provider number', async () => {
    const originalFetch = global.fetch;
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalSender = config.whatsapp.senderNumber;

    try {
      config.whatsapp.phoneNumberId = '10987654321';
      config.whatsapp.accessToken = 'test_valid_access_token';
      config.whatsapp.senderNumber = '+91 91234 56789';

      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          display_phone_number: '+91 98765 43210',
          verified_name: 'sifon-service Support',
          quality_rating: 'GREEN',
        }),
      });

      const check = await verifyWhatsAppProviderConnection();
      assert.equal(check.isConfigured, true);
      assert.equal(check.status, 'Setup required');
      assert.equal(check.matched, false);
      assert.ok(check.message.includes('Sender mismatch'));
    } finally {
      global.fetch = originalFetch;
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('reports "Ready" when WHATSAPP_SENDER_NUMBER matches provider registered number', async () => {
    const originalFetch = global.fetch;
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalSender = config.whatsapp.senderNumber;

    try {
      config.whatsapp.phoneNumberId = '10987654321';
      config.whatsapp.accessToken = 'test_valid_access_token';
      config.whatsapp.senderNumber = '+91 98765 43210';

      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          display_phone_number: '+91 98765 43210',
          verified_name: 'sifon-service Support',
          quality_rating: 'GREEN',
        }),
      });

      const check = await verifyWhatsAppProviderConnection();
      assert.equal(check.isConfigured, true);
      assert.equal(check.status, 'Ready');
      assert.equal(check.matched, true);
      assert.equal(check.providerNumber, '+91 98765 43210');
      assert.equal(check.verifiedName, 'sifon-service Support');
    } finally {
      global.fetch = originalFetch;
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('reports "Connection error" when Meta Graph API returns 401 or network failure', async () => {
    const originalFetch = global.fetch;
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalSender = config.whatsapp.senderNumber;

    try {
      config.whatsapp.phoneNumberId = '10987654321';
      config.whatsapp.accessToken = 'expired_token';
      config.whatsapp.senderNumber = '+91 98765 43210';

      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid OAuth access token.' }
        }),
      });

      const check = await verifyWhatsAppProviderConnection();
      assert.equal(check.isConfigured, true);
      assert.equal(check.status, 'Connection error');
      assert.equal(check.matched, false);
      assert.ok(check.message.includes('rejected by Meta'));
    } finally {
      global.fetch = originalFetch;
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('refuses to dispatch queued messages and marks them Failed if sender status is not Ready', async () => {
    const originalId = config.whatsapp.phoneNumberId;
    const originalToken = config.whatsapp.accessToken;
    const originalSender = config.whatsapp.senderNumber;

    try {
      config.whatsapp.phoneNumberId = '10987654321';
      config.whatsapp.accessToken = 'valid_token';
      config.whatsapp.senderNumber = ''; // Missing sender number!

      // 1. Ensure settings are enabled
      const settings = await getNotificationSettings();
      settings.enabled = true;
      await settings.save();

      // 2. Create a test complaint and queue a notification
      const testComp = await Complaint.create({
        complaintNumber: 'WA-TEST-SENDER-FAIL',
        customerName: 'Test Unconnected',
        customerPhone: '9876500099',
        countryCode: '+91',
        customerAddress: 'Some address',
        area: 'Indiranagar',
        productName: 'Sample Unit',
        subject: 'Sender Check',
        description: 'Test sender verification guard',
        status: 'Registered',
      });

      const notif = await WhatsAppNotification.create({
        complaintId: testComp._id,
        complaintNumber: testComp.complaintNumber,
        destinationPhone: '919876500099',
        status: 'Queued',
        templateName: 'sifon_complaint_confirmation',
      });

      // 3. Process outbox
      await processWhatsAppOutbox();

      // 4. Verify the message was marked Failed and was NOT silently dispatched
      const checkedNotif = await WhatsAppNotification.findById(notif._id);
      assert.equal(checkedNotif.status, 'Failed');
      assert.ok(checkedNotif.errorDetails.includes('WHATSAPP_SENDER_NUMBER') || checkedNotif.errorDetails.includes('sender is not ready'));

      const checkedComp = await Complaint.findById(testComp._id);
      assert.equal(checkedComp.whatsappNotification.status, 'Failed');
    } finally {
      config.whatsapp.phoneNumberId = originalId;
      config.whatsapp.accessToken = originalToken;
      config.whatsapp.senderNumber = originalSender;
    }
  });

  it('does NOT send or queue notification when checkbox is UNCHECKED', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'WA-NO-SEND-001',
        customerName: 'Silent Customer',
        customerPhone: '9876500001',
        countryCode: '+91',
        sendWhatsAppConfirmation: false, // Unchecked
        customerAddress: '12 Quiet Lane',
        area: 'Jayanagar',
        productName: 'RO Basic',
        subject: 'No Notification Test',
        description: 'Verifying that unchecked checkbox sends nothing',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.whatsappStatus, 'None');

    const notification = await WhatsAppNotification.findOne({ complaintId: res.body.data._id });
    assert.equal(notification, null, 'No notification should be created when checkbox is unchecked');
  });

  it('queues a WhatsApp confirmation when checkbox is CHECKED', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'WA-TEST-002',
        customerName: 'Karan Mehra',
        customerPhone: '9876543210',
        countryCode: '+91',
        sendWhatsAppConfirmation: true,
        customerAddress: '7th Cross Road',
        area: 'Indiranagar',
        productName: 'RO 15L',
        subject: 'WhatsApp Notification Test',
        description: 'Verifying automated WhatsApp queueing on creation',
      });

    assert.equal(res.status, 201);
    testComplaintId = res.body.data._id;

    // Check that outbox record was created in database
    const notification = await WhatsAppNotification.findOne({ complaintId: testComplaintId });
    assert.ok(notification, 'WhatsApp notification should be created in outbox');
    assert.equal(notification.destinationPhone, '919876543210');
    assert.equal(notification.consent.agreed, true);
    assert.ok(notification.consent.timestamp);
    assert.ok(['Queued', 'Processing', 'Failed'].includes(notification.status));

    // Verify complaint record has whatsappNotification subdocument updated
    const complaint = await Complaint.findById(testComplaintId);
    assert.equal(complaint.whatsappNotification.requested, true);
    assert.equal(complaint.whatsappNotification.destinationPhone, '919876543210');
  });

  it('rejects test message sending if test recipient number is missing or invalid', async () => {
    const res = await request(app)
      .post('/api/settings/notifications/test')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({ testRecipientPhone: '' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_RECIPIENT');
  });

  it('verifies Meta Webhook handshake GET with correct verify_token', async () => {
    const originalVerifyToken = config.whatsapp.webhookVerifyToken;
    try {
      config.whatsapp.webhookVerifyToken = 'test_webhook_verify_token_123';
      const challenge = 'CHALLENGE_STRING_12345';

      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_webhook_verify_token_123',
          'hub.challenge': challenge,
        });

      assert.equal(res.status, 200);
      assert.equal(res.text, challenge);
    } finally {
      config.whatsapp.webhookVerifyToken = originalVerifyToken;
    }
  });

  it('rejects Meta Webhook handshake with invalid verify_token', async () => {
    const originalVerifyToken = config.whatsapp.webhookVerifyToken;
    try {
      config.whatsapp.webhookVerifyToken = 'test_webhook_verify_token_123';

      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token_abc',
          'hub.challenge': 'some_challenge',
        });

      assert.equal(res.status, 403);
    } finally {
      config.whatsapp.webhookVerifyToken = originalVerifyToken;
    }
  });

  it('ingests WhatsApp delivery status updates via webhook with HMAC signature', async () => {
    const originalAppSecret = config.whatsapp.appSecret;
    try {
      config.whatsapp.appSecret = 'test_webhook_app_secret_123';
      const fakeMessageId = 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSR_' + Date.now();

      // Create an outbox notification with provider message ID
      await WhatsAppNotification.create({
        complaintId: testComplaintId,
        complaintNumber: 'WA-TEST-002',
        destinationPhone: '919876543210',
        status: 'Accepted by provider',
        providerMessageId: fakeMessageId,
        templateName: 'sifon_complaint_confirmation',
      });

      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: fakeMessageId,
                      status: 'delivered',
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      recipient_id: '919876543210',
                    }
                  ]
                },
                field: 'messages',
              }
            ]
          }
        ]
      };

      const payloadRaw = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac('sha256', config.whatsapp.appSecret)
        .update(payloadRaw)
        .digest('hex');

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', `sha256=${signature}`)
        .send(payloadRaw);

      assert.equal(res.status, 200);

      // Verify outbox record status was updated to Delivered
      const updated = await WhatsAppNotification.findOne({ providerMessageId: fakeMessageId });
      assert.equal(updated.status, 'Delivered');

      // Verify duplicate / out-of-order 'sent' status does NOT regress Delivered state
      const duplicatePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [{ id: fakeMessageId, status: 'sent', timestamp: String(Math.floor(Date.now() / 1000)) }]
                },
                field: 'messages',
              }
            ]
          }
        ]
      };
      const dupRaw = JSON.stringify(duplicatePayload);
      const dupSig = crypto.createHmac('sha256', config.whatsapp.appSecret).update(dupRaw).digest('hex');

      await request(app)
        .post('/api/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', `sha256=${dupSig}`)
        .send(dupRaw);

      const notRegressed = await WhatsAppNotification.findOne({ providerMessageId: fakeMessageId });
      assert.equal(notRegressed.status, 'Delivered', 'Status should not regress from Delivered back to Accepted by provider');
    } finally {
      config.whatsapp.appSecret = originalAppSecret;
    }
  });

  it('prevents retry when notification was already Accepted by provider or Delivered', async () => {
    // Attempting to retry an already delivered notification must throw error to prevent customer spam
    const res = await request(app)
      .post(`/api/complaints/${testComplaintId}/notifications/whatsapp/retry`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'RETRY_REJECTED');
    assert.ok(res.body.error.message.includes('already been accepted or delivered'));
  });

  it('allows retry when notification has Failed', async () => {
    // Mark latest notification as Failed
    await WhatsAppNotification.findOneAndUpdate(
      { complaintId: testComplaintId },
      { status: 'Failed', errorDetails: 'Test simulated failure' },
      { sort: { createdAt: -1 } }
    );

    const res = await request(app)
      .post(`/api/complaints/${testComplaintId}/notifications/whatsapp/retry`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'Queued');
  });

  describe('Manual Send on WhatsApp (Click-to-Chat) Flow', () => {
    it('normalizes international phone numbers into digits-only format', () => {
      assert.equal(formatInternationalPhone('+91 98765 43210'), '919876543210');
      assert.equal(formatInternationalPhone('9876543210', '91'), '919876543210');
      assert.equal(formatInternationalPhone('+1 (555) 0199'), '15550199');
      assert.equal(formatInternationalPhone('00919876543210'), '919876543210');
      assert.equal(formatInternationalPhone('09876543210', '91'), '919876543210');
      assert.equal(formatInternationalPhone(''), '');

      assert.equal(isValidInternationalPhone('919876543210'), true);
      assert.equal(isValidInternationalPhone('15550199'), true);
      assert.equal(isValidInternationalPhone('123'), false); // Too short (<7)
      assert.equal(isValidInternationalPhone('1234567890123456'), false); // Too long (>15)
      assert.equal(isValidInternationalPhone('abc919876543210'), false);
    });

    it('builds wa.me URL with properly encoded message and placeholder replacement', () => {
      const complaintData = {
        complaintNumber: 'SIF-2026/042',
        customerName: 'Priya Sharma',
        customerPhone: '+91 98765 43210',
        brandNameSnapshot: 'Kent',
        categoryNameSnapshot: 'Water Purifier',
        productName: 'RO Water Purifier',
        servicerNameSnapshot: 'Ramesh Patel',
        status: 'Registered',
      };

      const template = 'Hello {{customer_name}}, your complaint #{{complaint_id}} for {{brand_name}} {{product_name}} is {{status}} with {{company_name}}.';
      const link = buildWhatsAppClickToChatUrl(
        complaintData.customerPhone,
        template,
        complaintData,
        'Sifon Service',
        '91'
      );

      assert.equal(link.isValid, true);
      assert.equal(link.internationalDigits, '919876543210');
      assert.ok(link.url.startsWith('https://wa.me/919876543210?text='));
      assert.ok(link.url.includes(encodeURIComponent('Priya Sharma')));
      assert.ok(link.url.includes(encodeURIComponent('SIF-2026/042')));
      assert.ok(link.url.includes(encodeURIComponent('Kent')));
      assert.ok(link.url.includes(encodeURIComponent('Sifon Service')));
      assert.equal(
        link.renderedMessage,
        'Hello Priya Sharma, your complaint #SIF-2026/042 for Kent RO Water Purifier is Registered with Sifon Service.'
      );
    });

    it('gracefully handles missing optional fields in placeholder substitution', () => {
      const bareComplaint = {
        complaintNumber: 'SIF-BARE-01',
        customerPhone: '9876543210',
      };

      const template = 'Customer: {{customer_name}} | Ticket: {{complaint_id}} | Brand: {{brand_name}} | Servicer: {{servicer_name}} | Status: {{status}}';
      const link = buildWhatsAppClickToChatUrl(
        bareComplaint.customerPhone,
        template,
        bareComplaint,
        'sifon-service',
        '91'
      );

      assert.equal(link.isValid, true);
      assert.ok(link.renderedMessage.includes('Customer: Customer'));
      assert.ok(link.renderedMessage.includes('Ticket: SIF-BARE-01'));
      assert.ok(link.renderedMessage.includes('Brand: Not assigned'));
      assert.ok(link.renderedMessage.includes('Servicer: Unassigned'));
      assert.ok(link.renderedMessage.includes('Status: Registered'));
    });

    it('creates complaint without Meta credentials and returns whatsappLink in response', async () => {
      const origPhoneId = config.whatsapp.phoneNumberId;
      const origToken = config.whatsapp.accessToken;
      config.whatsapp.phoneNumberId = '';
      config.whatsapp.accessToken = '';

      try {
        const payload = {
          complaintNumber: 'WA-MANUAL-001',
          customerName: 'Aarav Patel',
          customerPhone: '9876543210',
          countryCode: '+91',
          customerAddress: '123 MG Road',
          area: 'Indiranagar',
          productName: 'Microwave Oven',
          subject: 'Heating element issue',
          description: 'Not heating food properly',
          priority: 'medium',
        };

        const res = await request(app)
          .post('/api/complaints')
          .set('Cookie', auth.cookies)
          .set('X-CSRF-Token', auth.csrfToken)
          .send(payload);

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data._id);
        assert.equal(res.body.data.complaintNumber, 'WA-MANUAL-001');

        // whatsappLink should be returned for click-to-chat
        assert.ok(res.body.whatsappLink);
        assert.equal(res.body.whatsappLink.isValid, true);
        assert.equal(res.body.whatsappLink.internationalDigits, '919876543210');
        assert.ok(res.body.whatsappLink.url.startsWith('https://wa.me/919876543210?text='));
      } finally {
        config.whatsapp.phoneNumberId = origPhoneId;
        config.whatsapp.accessToken = origToken;
      }
    });

    it('fetches Click-to-Chat WhatsApp link for a complaint via GET /api/complaints/:id/whatsapp-link', async () => {
      const complaint = await Complaint.findOne({ complaintNumber: 'WA-MANUAL-001' });
      assert.ok(complaint);

      const res = await request(app)
        .get(`/api/complaints/${complaint._id}/whatsapp-link`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
      assert.equal(res.body.data.isValid, true);
      assert.equal(res.body.data.internationalDigits, '919876543210');
      assert.ok(res.body.data.url.startsWith('https://wa.me/919876543210?text='));
      assert.ok(res.body.data.renderedMessage.includes('Aarav Patel'));
    });

    it('persists message template settings in MongoDB after update', async () => {
      const updatePayload = {
        enabled: true,
        companyName: 'Sifon Care Pro',
        customMessageDraft: 'Greetings {{customer_name}}! Ticket #{{complaint_id}} registered with {{company_name}}. Status: {{status}}.',
      };

      const patchRes = await request(app)
        .patch('/api/settings/notifications')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send(updatePayload);

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.success, true);
      assert.equal(patchRes.body.data.companyName, 'Sifon Care Pro');
      assert.equal(patchRes.body.data.customMessageDraft, updatePayload.customMessageDraft);

      // Verify persistence via subsequent GET
      const getRes = await request(app)
        .get('/api/settings/notifications')
        .set('Cookie', auth.cookies);

      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.companyName, 'Sifon Care Pro');
      assert.equal(getRes.body.data.customMessageDraft, updatePayload.customMessageDraft);
    });

    it('generates test Click-to-Chat link via POST /api/settings/notifications/test', async () => {
      const res = await request(app)
        .post('/api/settings/notifications/test')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({ testRecipientPhone: '+91 99887 76655' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
      assert.equal(res.body.data.internationalDigits, '919988776655');
      assert.ok(res.body.data.url.startsWith('https://wa.me/919988776655?text='));
      assert.ok(res.body.data.renderedMessage.includes('Sifon Care Pro'));
    });

    describe('GET /api/complaints/:id/whatsapp-link Endpoint & Error Routing', () => {
      let testComplaint;

      before(async () => {
        testComplaint = await Complaint.create({
          complaintNumber: 'WA-ROUTING-001',
          complaintNumberLower: 'wa-routing-001',
          customerName: 'Kavita Verma',
          customerPhone: '9876543210',
          countryCode: '+91',
          customerAddress: '55 Indiranagar 100ft Rd',
          area: 'Indiranagar',
          productName: 'Air Conditioner',
          subject: 'Cooling gas leakage',
          description: 'AC blowing room temperature air',
          priority: 'high',
        });
      });

      it('exact GET /api/complaints/:id/whatsapp-link route is registered and returns 200 with wa.me link', async () => {
        const res = await request(app)
          .get(`/api/complaints/${testComplaint._id}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data);
        assert.equal(res.body.data.isValid, true);
        assert.equal(res.body.data.internationalDigits, '919876543210');
        assert.ok(res.body.data.url.startsWith('https://wa.me/919876543210?text='));
        assert.ok(res.body.data.renderedMessage.includes('Kavita Verma'));
        assert.ok(res.body.data.renderedMessage.includes('WA-ROUTING-001'));
      });

      it('rejects unauthenticated access with 401 UNAUTHORIZED', async () => {
        const res = await request(app)
          .get(`/api/complaints/${testComplaint._id}/whatsapp-link`);

        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'UNAUTHORIZED');
      });

      it('returns 404 NOT_FOUND when complaint does not exist (not a phone validation error)', async () => {
        const nonExistentId = '65f9bf520840f1364898d999';
        const res = await request(app)
          .get(`/api/complaints/${nonExistentId}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(res.status, 404);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'NOT_FOUND');
        assert.equal(res.body.error.message, 'Complaint not found');
      });

      it('returns 400 INVALID_ID when MongoDB ObjectId format is invalid', async () => {
        const res = await request(app)
          .get('/api/complaints/not-a-valid-objectid/whatsapp-link')
          .set('Cookie', auth.cookies);

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'INVALID_ID');
      });

      it('handles international numbers (+44 UK) and stores countryCode properly', async () => {
        const ukComplaint = await Complaint.create({
          complaintNumber: 'WA-UK-001',
          complaintNumberLower: 'wa-uk-001',
          customerName: 'Oliver Smith',
          customerPhone: '7911123456',
          countryCode: '+44',
          customerAddress: '10 Downing St',
          area: 'Westminster',
          productName: 'Espresso Machine',
          subject: 'Pressure valve issue',
          description: 'Steam wand leaking',
          priority: 'medium',
        });

        const res = await request(app)
          .get(`/api/complaints/${ukComplaint._id}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.isValid, true);
        assert.equal(res.body.data.internationalDigits, '447911123456');
        assert.ok(res.body.data.url.startsWith('https://wa.me/447911123456?text='));
      });

      it('allows phone correction via PATCH /api/complaints/:id and updates wa.link without re-registration', async () => {
        // 1. Create a complaint with an invalid phone (10 zeros)
        const invalidComplaint = await Complaint.create({
          complaintNumber: 'WA-INVAL-001',
          complaintNumberLower: 'wa-inval-001',
          customerName: 'Typo Phone User',
          customerPhone: '0000000000',
          countryCode: '+91',
          customerAddress: '101 MG Rd',
          area: 'Shivajinagar',
          productName: 'Microwave',
          subject: 'Sparking',
          description: 'Internal turntable sparks',
          priority: 'urgent',
        });

        // 2. Fetch whatsapp-link -> reports INVALID_PHONE
        const linkRes1 = await request(app)
          .get(`/api/complaints/${invalidComplaint._id}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(linkRes1.status, 200);
        assert.equal(linkRes1.body.data.isValid, false);
        assert.equal(linkRes1.body.data.reason, 'INVALID_PHONE');
        assert.equal(linkRes1.body.data.error, 'Enter a valid customer WhatsApp number with country code.');

        // 3. Admin corrects customer phone and country code via PATCH /api/complaints/:id
        const patchRes = await request(app)
          .patch(`/api/complaints/${invalidComplaint._id}`)
          .set('Cookie', auth.cookies)
          .set('X-CSRF-Token', auth.csrfToken)
          .send({
            customerPhone: '9876543210',
            countryCode: '+91',
            version: invalidComplaint.version,
          });

        assert.equal(patchRes.status, 200);
        assert.equal(patchRes.body.data.customerPhone, '9876543210');
        assert.equal(patchRes.body.data.countryCode, '+91');

        // 4. Fetch whatsapp-link again -> now valid with correct digits
        const linkRes2 = await request(app)
          .get(`/api/complaints/${invalidComplaint._id}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(linkRes2.status, 200);
        assert.equal(linkRes2.body.data.isValid, true);
        assert.equal(linkRes2.body.data.internationalDigits, '919876543210');
        assert.ok(linkRes2.body.data.url.startsWith('https://wa.me/919876543210?text='));
      });

      it('normalizes duplicated country code when full number is entered with country code', async () => {
        const dupComplaint = await Complaint.create({
          complaintNumber: 'WA-DUP-001',
          complaintNumberLower: 'wa-dup-001',
          customerName: 'Pasted Number User',
          customerPhone: '+91 919876543210', // duplicated 91
          countryCode: '+91',
          customerAddress: '202 Residency Rd',
          area: 'Shanthala Nagar',
          productName: 'Geyser',
          subject: 'No hot water',
          description: 'Heating rod not working',
          priority: 'medium',
        });

        const res = await request(app)
          .get(`/api/complaints/${dupComplaint._id}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.isValid, true);
        assert.equal(res.body.data.internationalDigits, '919876543210');
      });

      it('returns distinct DISABLED reason when click-to-chat is turned off in settings', async () => {
        // Disable click to chat
        await request(app)
          .patch('/api/settings/notifications')
          .set('Cookie', auth.cookies)
          .set('X-CSRF-Token', auth.csrfToken)
          .send({ clickToChatEnabled: false });

        const res = await request(app)
          .get(`/api/complaints/${testComplaint._id}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.isValid, false);
        assert.equal(res.body.data.reason, 'DISABLED');
        assert.equal(res.body.data.error, 'Enable WhatsApp click-to-chat in Account Settings.');

        // Re-enable for other tests
        await request(app)
          .patch('/api/settings/notifications')
          .set('Cookie', auth.cookies)
          .set('X-CSRF-Token', auth.csrfToken)
          .send({ clickToChatEnabled: true });
      });

      it('never outputs "undefined" for missing optional complaint fields', async () => {
        const bareComplaint = await Complaint.create({
          complaintNumber: 'WA-BARE-002',
          complaintNumberLower: 'wa-bare-002',
          customerName: 'Minimal Customer',
          customerPhone: '9876543210',
          customerAddress: 'Minimal Address',
          area: 'Minimal Area',
          productName: 'Minimal Product',
          subject: 'Minimal Subject',
          description: 'Minimal Description',
        });

        const res = await request(app)
          .get(`/api/complaints/${bareComplaint._id}/whatsapp-link`)
          .set('Cookie', auth.cookies);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.isValid, true);
        assert.equal(res.body.data.renderedMessage.includes('undefined'), false);
        assert.equal(res.body.data.url.includes('undefined'), false);
      });

      it('works seamlessly without any Meta credentials or environment configuration', async () => {
        const origId = config.whatsapp.phoneNumberId;
        const origToken = config.whatsapp.accessToken;
        config.whatsapp.phoneNumberId = '';
        config.whatsapp.accessToken = '';

        try {
          const res = await request(app)
            .get(`/api/complaints/${testComplaint._id}/whatsapp-link`)
            .set('Cookie', auth.cookies);

          assert.equal(res.status, 200);
          assert.equal(res.body.data.isValid, true);
          assert.ok(res.body.data.url.startsWith('https://wa.me/919876543210?text='));
        } finally {
          config.whatsapp.phoneNumberId = origId;
          config.whatsapp.accessToken = origToken;
        }
      });
    });

    describe('Customer Phone Validation and Duplicate Country Code Handling', () => {
      it('validates 10-digit Indian numbers with +91 selector and standard formatting', () => {
        const res = validateAndFormatCustomerPhone('9876543210', '+91');
        assert.equal(res.isValid, true);
        assert.equal(res.internationalDigits, '919876543210');
        assert.equal(res.e164, '+919876543210');
        assert.equal(res.formatted, '+91 98765 43210');
        assert.equal(res.error, null);
      });

      it('validates 10-digit Indian numbers starting with 91 series (e.g. 9123456789) without false deduplication', () => {
        const res = validateAndFormatCustomerPhone('9123456789', '+91');
        assert.equal(res.isValid, true);
        assert.equal(res.internationalDigits, '919123456789');
        assert.equal(res.e164, '+919123456789');
        assert.equal(res.formatted, '+91 91234 56789');
      });

      it('normalizes Indian numbers with domestic trunk prefix 0 (e.g. 09876543210)', () => {
        const res = validateAndFormatCustomerPhone('09876543210', '+91');
        assert.equal(res.isValid, true);
        assert.equal(res.internationalDigits, '919876543210');
        assert.equal(res.e164, '+919876543210');
      });

      it('strips redundant duplicated country code (e.g. 91919876543210 or +91 919876543210)', () => {
        const res1 = validateAndFormatCustomerPhone('91919876543210', '+91');
        assert.equal(res1.isValid, true);
        assert.equal(res1.internationalDigits, '919876543210');

        const res2 = validateAndFormatCustomerPhone('+91 919876543210', '+91');
        assert.equal(res2.isValid, true);
        assert.equal(res2.internationalDigits, '919876543210');
      });

      it('validates international phone numbers (+1 US, +44 UK, +971 UAE)', () => {
        const usRes = validateAndFormatCustomerPhone('+1 (202) 555-0123', '+1');
        assert.equal(usRes.isValid, true);
        assert.equal(usRes.internationalDigits, '12025550123');
        assert.equal(usRes.country, 'US');

        const ukRes = validateAndFormatCustomerPhone('+44 7911 123456', '+44');
        assert.equal(ukRes.isValid, true);
        assert.equal(ukRes.internationalDigits, '447911123456');

        const uaeRes = validateAndFormatCustomerPhone('+971 50 123 4567', '+971');
        assert.equal(uaeRes.isValid, true);
        assert.equal(uaeRes.internationalDigits, '971501234567');
        assert.equal(uaeRes.country, 'AE');
      });

      it('rejects invalid or ambiguous phone numbers with specific field errors', () => {
        // Alphabetic characters
        const alpha = validateAndFormatCustomerPhone('abc9876543210', '+91');
        assert.equal(alpha.isValid, false);
        assert.equal(alpha.code, 'INVALID_PHONE');
        assert.equal(alpha.error, 'Enter a valid customer WhatsApp number with country code.');

        // Invalid symbols
        const symbol = validateAndFormatCustomerPhone('98765#43210', '+91');
        assert.equal(symbol.isValid, false);
        assert.equal(symbol.code, 'INVALID_PHONE');

        // Multiple + or + in middle
        const malformed = validateAndFormatCustomerPhone('91+9876543210', '+91');
        assert.equal(malformed.isValid, false);
        assert.equal(malformed.code, 'INVALID_PHONE');

        // Too short
        const short = validateAndFormatCustomerPhone('12345', '+91');
        assert.equal(short.isValid, false);
        assert.equal(short.code, 'INVALID_PHONE');

        // Invalid repeating zeros
        const zeros = validateAndFormatCustomerPhone('0000000000', '+91');
        assert.equal(zeros.isValid, false);
        assert.equal(zeros.code, 'INVALID_PHONE');

        // Empty / whitespace
        const empty = validateAndFormatCustomerPhone('   ', '+91');
        assert.equal(empty.isValid, false);
        assert.equal(empty.code, 'REQUIRED');
      });
    });
  });
});
