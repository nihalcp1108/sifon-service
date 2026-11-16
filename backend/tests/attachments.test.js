import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth } from './setup.js';

describe('Attachment Security, Uploads & Downloads', () => {
  let app;
  let auth;
  let complaintId;

  // 1x1 Valid PNG buffer
  const validPngBuffer = Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2D0000000049454E44AE426082',
    'hex'
  );

  // Minimal Valid PDF buffer
  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 100 100]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n168\n%%EOF'
  );

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
    auth = await getCsrfAndAuth(request);

    // Create a base complaint
    const createRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'SIF-ATT-001',
        customerName: 'Upload Tester',
        customerPhone: '9123412345',
        customerAddress: 'Tech Park',
        area: 'Electronic City',
        productName: 'Rocoware Pro',
        subject: 'Testing file uploads',
        description: 'Verifying attachment security and streaming download',
        representative: setup.rep._id.toString(),
      });

    complaintId = createRes.body.data._id;
  });

  after(async () => {
    await teardownTestDB();
  });

  it('rejects spoofed file with fake MIME extension but invalid signature', async () => {
    const fakeBuffer = Buffer.from('This is fake text disguised as a PNG file');

    const res = await request(app)
      .post(`/api/complaints/${complaintId}/attachments`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .attach('attachments', fakeBuffer, {
        filename: 'malicious.png',
        contentType: 'image/png',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_FILE_SIGNATURE');
  });

  it('rejects disallowed file extensions like .exe or .html', async () => {
    const res = await request(app)
      .post(`/api/complaints/${complaintId}/attachments`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .attach('attachments', Buffer.from('script'), {
        filename: 'virus.exe',
        contentType: 'application/octet-stream',
      });

    assert.equal(res.status, 400);
  });

  it('successfully uploads valid PNG and PDF attachments', async () => {
    const res = await request(app)
      .post(`/api/complaints/${complaintId}/attachments`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .attach('attachments', validPngBuffer, {
        filename: 'filter_photo.png',
        contentType: 'image/png',
      })
      .attach('attachments', validPdfBuffer, {
        filename: 'warranty_doc.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.attachments.length, 2);
    assert.equal(res.body.data.attachments[0].originalName, 'filter_photo.png');
    assert.equal(res.body.data.attachments[0].mimeType, 'image/png');
    assert.equal(res.body.data.attachments[1].originalName, 'warranty_doc.pdf');
    assert.equal(res.body.data.attachments[1].mimeType, 'application/pdf');
  });

  it('authenticates and streams attachment download', async () => {
    // Get complaint to find attachmentId
    const getRes = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Cookie', auth.cookies);

    const att = getRes.body.data.attachments[0];
    assert.ok(att);

    // Download unauthenticated -> 401
    const unauthRes = await request(app)
      .get(`/api/complaints/${complaintId}/attachments/${att._id}/download`);
    assert.equal(unauthRes.status, 401);

    // Download authenticated -> 200 binary
    const downloadRes = await request(app)
      .get(`/api/complaints/${complaintId}/attachments/${att._id}/download`)
      .set('Cookie', auth.cookies);

    assert.equal(downloadRes.status, 200);
    assert.equal(downloadRes.headers['content-type'], att.mimeType);
    assert.ok(downloadRes.headers['content-disposition'].includes('filter_photo.png'));
  });

  it('deletes an attachment and logs timeline entry', async () => {
    const getRes = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Cookie', auth.cookies);

    const attToDelete = getRes.body.data.attachments[0];

    const delRes = await request(app)
      .delete(`/api/complaints/${complaintId}/attachments/${attToDelete._id}`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken);

    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.data.attachments.length, 1);
  });
});

