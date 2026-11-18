import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth, defaultTestRep } from './setup.js';
import { Complaint } from '../src/models/Complaint.js';
import { Brand } from '../src/models/Brand.js';
import { Category } from '../src/models/Category.js';
import { generateComplaintPDF, generateComplaintReportPDF } from '../src/services/pdfService.js';

describe('Shop Name & PDF Layout Modifications', () => {
  let app;
  let auth;
  let testBrand;
  let testCategory;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
    auth = await getCsrfAndAuth(request);

    testBrand = await Brand.create({
      name: 'Samsung',
      nameLower: 'samsung',
      description: 'Test Brand',
      isActive: true,
    });

    testCategory = await Category.create({
      name: 'Refrigerator',
      nameLower: 'refrigerator',
      description: 'Test Category',
      isActive: true,
    });
  });

  after(async () => {
    await teardownTestDB();
  });

  describe('1. Shop Name Persistence, Validation & Editing', () => {
    it('creates a complaint with shopName, trimming surrounding whitespace', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'SHOP-TEST-001',
          customerName: 'Rahul Verma',
          customerPhone: '9876543210',
          customerAddress: '12 Brigade Road',
          area: 'MG Road',
          shopName: '   Modern Electronics & Co   ',
          representative: defaultTestRep._id.toString(),
          brand: String(testBrand._id),
          category: String(testCategory._id),
          productName: 'Double Door Refrigerator',
          subject: 'Cooling problem',
          description: 'Upper freezer works but lower compartment does not cool properly.',
          priority: 'medium',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.shopName, 'Modern Electronics & Co');

      // Verify directly in MongoDB
      const doc = await Complaint.findById(res.body.data._id);
      assert.equal(doc.shopName, 'Modern Electronics & Co');
    });

    it('rejects shopName exceeding maximum character length (150 chars)', async () => {
      const longShopName = 'A'.repeat(151);
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'SHOP-TOO-LONG-001',
          customerName: 'Rahul Verma',
          customerPhone: '9876543210',
          customerAddress: '12 Brigade Road',
          area: 'MG Road',
          shopName: longShopName,
          representative: defaultTestRep._id.toString(),
          productName: 'Double Door Refrigerator',
          subject: 'Cooling problem',
          description: 'Freezer not cooling.',
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error?.message?.includes('Invalid complaint registration data') || res.body.error?.details);
    });

    it('creates complaint without shopName and defaults to empty string gracefully', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'NO-SHOP-001',
          customerName: 'Priya Sundaram',
          customerPhone: '9876543211',
          customerAddress: '45 Residency Road',
          area: 'Shanthi Nagar',
          representative: defaultTestRep._id.toString(),
          productName: 'RO Purifier',
          subject: 'Filter replacement',
          description: 'Routine maintenance and filter replacement requested by customer.',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.shopName, '');

      // Verify in DB
      const doc = await Complaint.findById(res.body.data._id);
      assert.equal(doc.shopName, '');
    });

    it('edits shopName on existing complaint and records in timeline', async () => {
      const complaint = await Complaint.findOne({ complaintNumber: 'SHOP-TEST-001' });

      const res = await request(app)
        .patch(`/api/complaints/${complaint._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          shopName: 'Metro Electronics Center',
          version: complaint.version,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.shopName, 'Metro Electronics Center');

      // Verify reloaded from DB
      const updated = await Complaint.findById(complaint._id);
      assert.equal(updated.shopName, 'Metro Electronics Center');
      assert.ok(updated.timeline.some(t => t.details?.includes('Shop Name updated')));
    });

    it('searches complaints by shopName via backend query', async () => {
      const res = await request(app)
        .get('/api/complaints?search=Metro')
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.complaints.length >= 1);
      assert.equal(res.body.data.complaints[0].shopName, 'Metro Electronics Center');
    });

    it('handles legacy complaints without shopName when editing other fields', async () => {
      // Simulate legacy record without shopName
      const legacy = await Complaint.create({
        complaintNumber: 'LEGACY-NO-SHOP',
        complaintNumberLower: 'legacy-no-shop',
        customerName: 'Old Customer',
        customerPhone: '9988776655',
        customerAddress: 'Old Address',
        area: 'Old Area',
        representative: defaultTestRep._id,
        representativeNameSnapshot: defaultTestRep.name,
        productName: 'Legacy Purifier',
        subject: 'Annual Maintenance',
        description: 'Legacy complaint description from old system.',
      });

      const res = await request(app)
        .patch(`/api/complaints/${legacy._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          customerName: 'Updated Old Customer',
          version: legacy.version,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.customerName, 'Updated Old Customer');
      assert.equal(res.body.data.shopName || '', '');
    });
  });

  describe('2. PDF Layout & Field Verification', () => {
    it('generates individual complaint PDF stream with updated layout', async () => {
      const complaint = await Complaint.findOne({ complaintNumber: 'SHOP-TEST-001' })
        .populate('brand representative assignedServicer');

      const doc = generateComplaintPDF(complaint);
      assert.ok(doc);

      const chunks = [];
      await new Promise((resolve, reject) => {
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', resolve);
        doc.on('error', reject);
        doc.end();
      });

      const buffer = Buffer.concat(chunks);
      assert.ok(buffer.length > 500);
      assert.equal(buffer.toString('ascii', 0, 5), '%PDF-');
    });

    it('generates active complaints tabular report with multiline descriptions and new columns', async () => {
      const complaints = await Complaint.find({ isArchived: false })
        .populate('brand representative assignedServicer');

      // Add a long description to one complaint to test multiline wrapping
      complaints[0].description = 'First line of detailed diagnosis. '.repeat(15) + 'Second paragraph with details. '.repeat(10);

      const doc = generateComplaintReportPDF(complaints, {
        reportTitle: 'ACTIVE COMPLAINTS REGISTER',
        isCompletedReport: false,
      });

      const chunks = [];
      await new Promise((resolve, reject) => {
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', resolve);
        doc.on('error', reject);
        doc.end();
      });

      const buffer = Buffer.concat(chunks);
      assert.ok(buffer.length > 500);
      assert.equal(buffer.toString('ascii', 0, 5), '%PDF-');
    });

    it('generates completed complaints tabular report with service details and description', async () => {
      const complaints = await Complaint.find({ isArchived: false })
        .populate('brand representative assignedServicer');

      const doc = generateComplaintReportPDF(complaints, {
        reportTitle: 'COMPLETED SERVICE REGISTER',
        isCompletedReport: true,
      });

      const chunks = [];
      await new Promise((resolve, reject) => {
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', resolve);
        doc.on('error', reject);
        doc.end();
      });

      const buffer = Buffer.concat(chunks);
      assert.ok(buffer.length > 500);
      assert.equal(buffer.toString('ascii', 0, 5), '%PDF-');
    });

    it('exports PDF via HTTP endpoint /api/complaints/export/pdf successfully', async () => {
      const res = await request(app)
        .get('/api/complaints/export/pdf?exportAll=true')
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');
      const buf = Buffer.from(res.body);
      assert.ok(buf.length > 500);
      assert.equal(buf.toString('ascii', 0, 5), '%PDF-');
    });
  });
});

