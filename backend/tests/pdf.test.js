import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth } from './setup.js';

describe('PDF Generation & Reports', () => {
  let app;
  let auth;
  let testComplaint;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
    auth = await getCsrfAndAuth(request);

    // Create a complaint with complete fields for PDF testing
    const createRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'SIF-PDF-001',
        customerName: 'Suresh Raina',
        customerPhone: '9876500000',
        alternatePhone: '9876500001',
        customerEmail: 'suresh@cricket.local',
        customerAddress: '100 Stadium Road, Sector 3',
        area: 'Koramangala',
        productName: 'Rocoware Commercial RO 50LPH',
        modelNumber: 'RCW-COM-50',
        serialNumber: 'SN-99887766',
        purchaseDate: '2025-01-15',
        warrantyStatus: 'in_warranty',
        subject: 'Membrane clogging & TDS reading high',
        description: 'Water input TDS is 800, but output TDS rose to 350. Filter needs backwash or replacement.',
        priority: 'urgent',
      });

    testComplaint = createRes.body.data;
  });

  after(async () => {
    await teardownTestDB();
  });

  it('generates an individual complaint PDF with correct headers and valid PDF magic bytes', async () => {
    const res = await request(app)
      .get(`/api/complaints/${testComplaint._id}/pdf`)
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(res.headers['content-disposition'].includes(`sifon-service-complaint-${testComplaint.complaintNumber}.pdf`));
    
    // Verify magic bytes %PDF-
    const bodyBuffer = Buffer.from(res.body);
    assert.ok(bodyBuffer.length > 500);
    const headerStr = bodyBuffer.toString('ascii', 0, 5);
    assert.equal(headerStr, '%PDF-');
  });

  it('exports all complaints as a report PDF across pages', async () => {
    const res = await request(app)
      .get('/api/complaints/export/pdf?exportAll=true')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(
      res.headers['content-disposition'].includes('sifon-service-all-active-complaints-') ||
      res.headers['content-disposition'].includes('sifon-service-all-complaints-')
    );

    const bodyBuffer = Buffer.from(res.body);
    assert.ok(bodyBuffer.length > 500);
    assert.equal(bodyBuffer.toString('ascii', 0, 5), '%PDF-');
  });

  it('exports filtered complaints matching search or criteria', async () => {
    const res = await request(app)
      .get('/api/complaints/export/pdf?search=Suresh&priority=urgent')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');

    const bodyBuffer = Buffer.from(res.body);
    assert.ok(bodyBuffer.length > 500);
    assert.equal(bodyBuffer.toString('ascii', 0, 5), '%PDF-');
  });

  it('gracefully exports an empty report without throwing', async () => {
    const res = await request(app)
      .get('/api/complaints/export/pdf?search=NonExistentQueryXYZ123')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');

    const bodyBuffer = Buffer.from(res.body);
    assert.ok(bodyBuffer.length > 300);
    assert.equal(bodyBuffer.toString('ascii', 0, 5), '%PDF-');
  });
});

