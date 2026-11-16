import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth, defaultTestRep } from './setup.js';
import { Servicer } from '../src/models/Servicer.js';
import { Brand } from '../src/models/Brand.js';
import { Category } from '../src/models/Category.js';

describe('Complaints, Servicers & Workflow Rules', () => {
  let app;
  let auth;
  let testServicer;
  let testBrand;
  let testCategory;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
    auth = await getCsrfAndAuth(request);

    // Create a test active servicer
    testServicer = await Servicer.create({
      name: 'Ramesh Kumar',
      phone: '9876543210',
      email: 'ramesh@service.local',
      serviceArea: 'South Zone',
      specialization: 'Water Purifier',
      isActive: true,
    });

    // Create test active brand & category
    testBrand = await Brand.create({
      name: 'Aquafresh',
      nameLower: 'aquafresh',
      description: 'Test Brand',
      isActive: true,
    });

    testCategory = await Category.create({
      name: 'Water Purifier',
      nameLower: 'water purifier',
      description: 'Test Category',
      isActive: true,
    });
  });

  after(async () => {
    await teardownTestDB();
  });

  it('rejects complaint creation when required manual Complaint ID is missing', async () => {
    const invalidRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        customerName: 'Anil Sharma',
        customerPhone: '9123456780',
        customerAddress: '42 MG Road, Bangalore',
        area: 'Indiranagar',
        representative: defaultTestRep._id.toString(),
        productName: 'RO Filter',
        subject: 'Low water flow',
        description: 'Water filtration rate dropped significantly over the past 2 days.',
      });
    assert.equal(invalidRes.status, 400);
    assert.ok(invalidRes.body.error?.message?.includes('Complaint ID') || invalidRes.body.error?.details);
  });

  it('creates a new complaint with manual Complaint ID and preserves leading zeros', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: '00789',
        customerName: 'Anil Sharma',
        customerPhone: '9123456780',
        customerAddress: '42 MG Road, Bangalore',
        area: 'Indiranagar',
        representative: defaultTestRep._id.toString(),
        brand: String(testBrand._id),
        category: String(testCategory._id),
        productName: 'sifon-service Pro Filter',
        subject: 'Low water flow',
        description: 'Water filtration rate dropped significantly over the past 2 days.',
        priority: 'high',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.complaintNumber, '00789'); // Preserves leading zeros!
    assert.equal(res.body.data.customerName, 'Anil Sharma');
    assert.equal(res.body.data.status, 'Registered');
    assert.equal(res.body.data.brandNameSnapshot, 'Aquafresh');
    assert.equal(res.body.data.categoryNameSnapshot, 'Water Purifier');
    assert.equal(res.body.data.version, 0);
  });

  it('enforces case-insensitive uniqueness and returns exact duplicate error message', async () => {
    // 1. Create SIF-2026/001
    const res1 = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'SIF-2026/001',
        customerName: 'Rahul Dravid',
        customerPhone: '9876543210',
        customerAddress: 'Chinnaswamy Stadium',
        area: 'MG Road',
        representative: defaultTestRep._id.toString(),
        productName: 'RO 20L',
        subject: 'Filter replacement',
        description: 'Need routine filter change after 6 months',
      });
    assert.equal(res1.status, 201);

    // 2. Try creating duplicate with same ID -> expect 400 with "This Complaint ID already exists."
    const res2 = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'SIF-2026/001',
        customerName: 'Different Customer',
        customerPhone: '9876543211',
        customerAddress: 'Koramangala',
        area: 'South',
        representative: defaultTestRep._id.toString(),
        productName: 'RO 20L',
        subject: 'Different issue',
        description: 'Some test issue',
      });
    assert.equal(res2.status, 400);
    assert.equal(res2.body.error.message, 'This Complaint ID already exists.');

    // 3. Try creating case-insensitive variant "sif-2026/001" -> expect 400 with "This Complaint ID already exists."
    const res3 = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'sif-2026/001',
        customerName: 'Third Customer',
        customerPhone: '9876543212',
        customerAddress: 'Indiranagar',
        area: 'East',
        representative: defaultTestRep._id.toString(),
        productName: 'RO 20L',
        subject: 'Third issue',
        description: 'Some third test issue',
      });
    assert.equal(res3.status, 400);
    assert.equal(res3.body.error.message, 'This Complaint ID already exists.');
  });

  it('accepts letters, numbers, hyphens, and slashes in Complaint ID', async () => {
    const validIds = ['SIF-01', 'SIF/2026/99', 'COMP-001-A/B'];
    for (const cid of validIds) {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: cid,
          customerName: 'Test Customer',
          customerPhone: '9876501234',
          customerAddress: '123 Main St',
          area: 'Central',
          representative: defaultTestRep._id.toString(),
          productName: 'RO Classic',
          subject: 'Testing valid ID format',
          description: 'Testing allowed characters in manual complaint ID',
        });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.complaintNumber, cid);
    }
  });

  it('enforces status transition rules: require servicer for Assigned/In Progress', async () => {
    // 1. Create a fresh complaint without servicer
    const createRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'STATUS-TEST-001',
        customerName: 'Pooja Verma',
        customerPhone: '9888877771',
        customerAddress: 'Flat 301, Palm Heights',
        area: 'Whitefield',
        representative: defaultTestRep._id.toString(),
        productName: 'sifon-service Elite',
        subject: 'Display not working',
        description: 'LED indicator stopped blinking and beeps intermittently',
      });

    const complaintId = createRes.body.data._id;

    // 2. Try changing status to Assigned without providing a servicer -> Expect 400
    const failStatusRes = await request(app)
      .patch(`/api/complaints/${complaintId}/status`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        status: 'Assigned',
        version: createRes.body.data.version,
      });

    assert.equal(failStatusRes.status, 400);
    assert.equal(failStatusRes.body.error.code, 'SERVICER_REQUIRED');

    // 3. Update with active servicer -> Expect 200
    const successStatusRes = await request(app)
      .patch(`/api/complaints/${complaintId}/status`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        status: 'Assigned',
        assignedServicer: String(testServicer._id),
        version: createRes.body.data.version,
      });

    assert.equal(successStatusRes.status, 200);
    assert.equal(successStatusRes.body.data.status, 'Assigned');
    assert.equal(successStatusRes.body.data.servicerNameSnapshot, testServicer.name);
  });

  it('enforces resolution notes requirement before marking Resolved or Closed', async () => {
    // 1. Create assigned complaint
    const createRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'RESOLVE-TEST-001',
        customerName: 'Deepak Roy',
        customerPhone: '9555544443',
        customerAddress: '12 Temple St',
        area: 'Jayanagar',
        representative: defaultTestRep._id.toString(),
        productName: 'sifon-service Pro',
        subject: 'Filter replacement needed',
        description: 'Scheduled filter life expired',
        assignedServicer: String(testServicer._id),
      });

    const complaint = createRes.body.data;

    // 2. Try marking Resolved without resolution notes -> Expect 400
    const failRes = await request(app)
      .patch(`/api/complaints/${complaint._id}/status`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        status: 'Resolved',
        version: complaint.version,
      });

    assert.equal(failRes.status, 400);
    assert.equal(failRes.body.error.code, 'RESOLUTION_REQUIRED');

    // 3. Mark Resolved with resolution notes -> Expect 200
    const okRes = await request(app)
      .patch(`/api/complaints/${complaint._id}/status`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Replaced sediment and carbon filters. Tested flow rate 1.5 L/min.',
        workPerformed: 'Filter cartridge overhaul',
        partsReplaced: 'Carbon Filter #CF400',
        serviceCharge: 650,
        version: complaint.version,
      });

    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.data.status, 'Resolved');
    assert.equal(okRes.body.data.resolution.serviceCharge, 650);
  });

  it('rejects assigning a deactivated servicer', async () => {
    const inactiveServicer = await Servicer.create({
      name: 'Old Servicer',
      phone: '9001122334',
      isActive: false,
    });

    const createRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'INACTIVE-SERV-001',
        customerName: 'Test Customer',
        customerPhone: '9888877772',
        customerAddress: '123 Main St',
        area: 'Koramangala',
        representative: defaultTestRep._id.toString(),
        productName: 'sifon-service Pure',
        subject: 'General checkup',
        description: 'Routine maintenance checkup',
        assignedServicer: String(inactiveServicer._id),
      });

    assert.equal(createRes.status, 400);
    assert.equal(createRes.body.error.code, 'INACTIVE_SERVICER');
  });

  it('handles concurrency conflicts with version checking', async () => {
    const createRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'CONFLICT-001',
        customerName: 'Conflict Test',
        customerPhone: '9777788889',
        customerAddress: 'Suite 4',
        area: 'BTM Layout',
        representative: defaultTestRep._id.toString(),
        productName: 'sifon-service Alpha',
        subject: 'Testing concurrency',
        description: 'Initial state for conflict test',
      });

    const complaint = createRes.body.data;

    // First update with version 0 succeeds and bumps version to 1
    const update1 = await request(app)
      .patch(`/api/complaints/${complaint._id}`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        priority: 'urgent',
        version: complaint.version, // 0
      });
    assert.equal(update1.status, 200);
    assert.equal(update1.body.data.version, 1);

    // Second concurrent update still sending version 0 must be rejected with 409
    const update2 = await request(app)
      .patch(`/api/complaints/${complaint._id}`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        priority: 'low',
        version: 0, // stale version
      });
    assert.equal(update2.status, 409);
    assert.equal(update2.body.error.code, 'CONCURRENCY_CONFLICT');
  });

  it('searches, filters, and paginates complaints', async () => {
    // Search by customer name
    const searchRes = await request(app)
      .get('/api/complaints?search=Anil')
      .set('Cookie', auth.cookies);
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.body.data.complaints.length >= 1);
    assert.equal(searchRes.body.data.complaints[0].customerName, 'Anil Sharma');

    // Filter by status
    const statusRes = await request(app)
      .get('/api/complaints?status=Resolved')
      .set('Cookie', auth.cookies);
    assert.equal(statusRes.status, 200);
    assert.ok(statusRes.body.data.complaints.every(c => c.status === 'Resolved'));

    // Filter by brand
    const brandRes = await request(app)
      .get(`/api/complaints?brand=${testBrand._id}`)
      .set('Cookie', auth.cookies);
    assert.equal(brandRes.status, 200);
    assert.ok(brandRes.body.data.complaints.length >= 1);

    // Filter by category
    const catRes = await request(app)
      .get(`/api/complaints?category=${testCategory._id}`)
      .set('Cookie', auth.cookies);
    assert.equal(catRes.status, 200);
    assert.ok(catRes.body.data.complaints.length >= 1);
  });

  it('archives and restores complaints cleanly', async () => {
    const createRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        complaintNumber: 'ARCHIVE-001',
        customerName: 'Archive Candidate',
        customerPhone: '9444433332',
        customerAddress: 'Road 5',
        area: 'Hebbal',
        representative: defaultTestRep._id.toString(),
        productName: 'sifon-service Nano',
        subject: 'To be archived',
        description: 'Testing archive workflow',
      });

    const cid = createRes.body.data._id;

    // Archive
    const archiveRes = await request(app)
      .patch(`/api/complaints/${cid}/archive`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken);
    assert.equal(archiveRes.status, 200);
    assert.equal(archiveRes.body.data.isArchived, true);

    // Normal list excludes archived record
    const listRes = await request(app)
      .get('/api/complaints?search=Archive+Candidate')
      .set('Cookie', auth.cookies);
    assert.equal(listRes.body.data.complaints.length, 0);

    // Archived view includes it
    const archivedListRes = await request(app)
      .get('/api/complaints?isArchived=true&search=Archive+Candidate')
      .set('Cookie', auth.cookies);
    assert.equal(archivedListRes.body.data.complaints.length, 1);

    // Restore
    const restoreRes = await request(app)
      .patch(`/api/complaints/${cid}/restore`)
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken);
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.body.data.isArchived, false);
  });
});
