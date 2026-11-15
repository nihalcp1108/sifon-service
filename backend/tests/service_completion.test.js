import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth } from './setup.js';
import { Complaint } from '../src/models/Complaint.js';
import { Servicer } from '../src/models/Servicer.js';
import { Brand } from '../src/models/Brand.js';
import { Category } from '../src/models/Category.js';

describe('Complaint Service Completion Workflow Tests', () => {
  let app;
  let auth;
  let activeServicer;
  let inactiveServicer;
  let testBrand;
  let testCategory;

  before(async () => {
    const res = await setupTestDB();
    app = res.app;
    auth = await getCsrfAndAuth(request);

    activeServicer = await Servicer.create({
      name: 'Ramesh Patel',
      phone: '9876543210',
      serviceArea: 'Central Mumbai',
      isActive: true,
    });

    inactiveServicer = await Servicer.create({
      name: 'Old Inactive Servicer',
      phone: '9876543211',
      isActive: false,
    });

    testBrand = await Brand.create({
      name: 'Voltas',
      description: 'Cooling appliances',
      isActive: true,
    });

    testCategory = await Category.create({
      name: 'Air Conditioner',
      description: 'Cooling systems',
      isActive: true,
    });
  });

  after(async () => {
    await teardownTestDB();
  });

  test('POST /api/complaints/:id/complete-service completes service atomically and sets Resolved status', async () => {
    const complaint = await Complaint.create({
      complaintNumber: 'CMP-2026-COMPL-001',
      customerName: 'Aarav Sharma',
      customerPhone: '9876543210',
      customerAddress: 'Flat 402, Sea Green Apts, Andheri West',
      subject: 'AC cooling failure',
      brand: testBrand._id,
      brandNameSnapshot: testBrand.name,
      category: testCategory._id,
      categoryNameSnapshot: testCategory.name,
      productName: '1.5 Ton Split AC',
      area: 'Andheri West',
      description: 'AC blowing warm air, outdoor unit noisy',
      status: 'Assigned',
      assignedServicer: activeServicer._id,
      servicerNameSnapshot: activeServicer.name,
      version: 0,
    });

    const completionDateStr = '2026-11-15';
    const res = await request(app)
      .post(`/api/complaints/${complaint._id}/complete-service`)
      .set('Cookie', auth.cookies)
      .set('x-csrf-token', auth.csrfToken)
      .send({
        assignedServicer: activeServicer._id.toString(),
        completedDate: completionDateStr,
        workPerformed: 'Replaced faulty capacitor and cleared condenser coil with nitrogen wash.',
        resolutionNotes: 'Cooling restored to 18C. Customer signed off on warranty card.',
        partsReplaced: '36uF Motor Run Capacitor',
        serviceCharge: 1250.50,
        additionalNotes: 'Advised customer to schedule annual service before summer season.',
        version: 0,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'Resolved');
    assert.equal(res.body.data.servicerNameSnapshot, 'Ramesh Patel');

    // Verify DB state
    const updated = await Complaint.findById(complaint._id);
    assert.equal(updated.status, 'Resolved');
    assert.equal(updated.resolution.workPerformed, 'Replaced faulty capacitor and cleared condenser coil with nitrogen wash.');
    assert.equal(updated.resolution.resolutionNotes, 'Cooling restored to 18C. Customer signed off on warranty card.');
    assert.equal(updated.resolution.partsReplaced, '36uF Motor Run Capacitor');
    assert.equal(updated.resolution.serviceCharge, 1250.50);
    assert.equal(updated.resolution.additionalNotes, 'Advised customer to schedule annual service before summer season.');
    assert.equal(updated.version, 1);

    // Verify Timeline entry
    const timelineEntry = updated.timeline.find(t => t.action === 'SERVICE_COMPLETED');
    assert.ok(timelineEntry, 'Timeline should contain SERVICE_COMPLETED action');
    assert.equal(timelineEntry.oldValue, 'Assigned');
    assert.equal(timelineEntry.newValue, 'Resolved');
    assert.ok(timelineEntry.details.includes('Ramesh Patel'));

    // Verify service note added for additional notes
    assert.ok(updated.serviceNotes.some(n => n.note.includes('Advised customer to schedule annual service')));
  });

  test('POST /api/complaints/:id/complete-service rejects already completed complaints', async () => {
    const complaint = await Complaint.create({
      complaintNumber: 'CMP-2026-COMPL-002',
      customerName: 'Priya Verma',
      customerPhone: '9876543212',
      customerAddress: 'B-12 Hill Road, Bandra',
      subject: 'Fridge not cooling',
      productName: 'Refrigerator',
      area: 'Bandra',
      description: 'Cooling issue',
      status: 'Resolved',
      assignedServicer: activeServicer._id,
      resolution: {
        workPerformed: 'Gas recharged',
        resolutionNotes: 'Done',
        completedDate: new Date(),
      },
      version: 1,
    });

    const res = await request(app)
      .post(`/api/complaints/${complaint._id}/complete-service`)
      .set('Cookie', auth.cookies)
      .set('x-csrf-token', auth.csrfToken)
      .send({
        assignedServicer: activeServicer._id.toString(),
        completedDate: '2026-11-15',
        workPerformed: 'Attempt duplicate completion',
        resolutionNotes: 'Duplicate notes',
        serviceCharge: 500,
        version: 1,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'ALREADY_COMPLETED');
  });

  test('POST /api/complaints/:id/complete-service rejects cancelled complaints', async () => {
    const complaint = await Complaint.create({
      complaintNumber: 'CMP-2026-COMPL-003',
      customerName: 'Kunal Joshi',
      customerPhone: '9876543213',
      customerAddress: 'Sector 4, Thane West',
      subject: 'Washing machine leakage',
      productName: 'Washing Machine',
      area: 'Thane',
      description: 'Cancelled by customer',
      status: 'Cancelled',
      version: 0,
    });

    const res = await request(app)
      .post(`/api/complaints/${complaint._id}/complete-service`)
      .set('Cookie', auth.cookies)
      .set('x-csrf-token', auth.csrfToken)
      .send({
        assignedServicer: activeServicer._id.toString(),
        completedDate: '2026-11-15',
        workPerformed: 'Testing cancelled block',
        resolutionNotes: 'Should fail',
        version: 0,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CANNOT_COMPLETE_CANCELLED');
  });

  test('POST /api/complaints/:id/complete-service rejects archived complaints', async () => {
    const complaint = await Complaint.create({
      complaintNumber: 'CMP-2026-COMPL-004',
      customerName: 'Meera Nair',
      customerPhone: '9876543214',
      customerAddress: 'Gokhale Road, Dadar',
      subject: 'Microwave spark issue',
      productName: 'Microwave Oven',
      area: 'Dadar',
      description: 'Not heating',
      status: 'Registered',
      isArchived: true,
      archivedAt: new Date(),
      version: 0,
    });

    const res = await request(app)
      .post(`/api/complaints/${complaint._id}/complete-service`)
      .set('Cookie', auth.cookies)
      .set('x-csrf-token', auth.csrfToken)
      .send({
        assignedServicer: activeServicer._id.toString(),
        completedDate: '2026-11-15',
        workPerformed: 'Testing archived block',
        resolutionNotes: 'Should fail',
        version: 0,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CANNOT_COMPLETE_ARCHIVED');
  });

  test('POST /api/complaints/:id/complete-service rejects inactive servicer', async () => {
    const complaint = await Complaint.create({
      complaintNumber: 'CMP-2026-COMPL-005',
      customerName: 'Vikram Singhania',
      customerPhone: '9876543215',
      customerAddress: 'Station Road, Borivali East',
      subject: 'Geyser thermostat issue',
      productName: 'Geyser',
      area: 'Borivali',
      description: 'Water not heating',
      status: 'Registered',
      version: 0,
    });

    const res = await request(app)
      .post(`/api/complaints/${complaint._id}/complete-service`)
      .set('Cookie', auth.cookies)
      .set('x-csrf-token', auth.csrfToken)
      .send({
        assignedServicer: inactiveServicer._id.toString(),
        completedDate: '2026-11-15',
        workPerformed: 'Testing inactive servicer',
        resolutionNotes: 'Should fail validation',
        version: 0,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_SERVICER');
  });

  test('POST /api/complaints/:id/complete-service enforces concurrency control', async () => {
    const complaint = await Complaint.create({
      complaintNumber: 'CMP-2026-COMPL-006',
      customerName: 'Sanjay Gupta',
      customerPhone: '9876543216',
      customerAddress: 'Link Road, Malad West',
      subject: 'TV display flicker',
      productName: 'Television',
      area: 'Malad',
      description: 'Display flicker',
      status: 'Assigned',
      assignedServicer: activeServicer._id,
      version: 3, // Current version is 3
    });

    const res = await request(app)
      .post(`/api/complaints/${complaint._id}/complete-service`)
      .set('Cookie', auth.cookies)
      .set('x-csrf-token', auth.csrfToken)
      .send({
        assignedServicer: activeServicer._id.toString(),
        completedDate: '2026-11-15',
        workPerformed: 'Replaced LVDS Cable',
        resolutionNotes: 'Picture stable',
        version: 1, // Stale version 1
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CONCURRENCY_CONFLICT');
  });

  test('GET /api/complaints?completedOnly=true filters only completed records', async () => {
    const res = await request(app)
      .get('/api/complaints?completedOnly=true')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.complaints));
    assert.ok(res.body.data.complaints.length > 0);

    // Every returned record must be Resolved or Closed, and not archived
    for (const c of res.body.data.complaints) {
      assert.ok(['Resolved', 'Closed'].includes(c.status), `Status must be Resolved or Closed, got ${c.status}`);
      assert.equal(c.isArchived, false);
    }
  });

  test('GET /api/complaints (active scope) never returns completed records', async () => {
    const res = await request(app)
      .get('/api/complaints')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.complaints));
    assert.ok(res.body.data.complaints.length > 0);

    // Every returned record must NOT be Resolved or Closed
    for (const c of res.body.data.complaints) {
      assert.ok(!['Resolved', 'Closed'].includes(c.status), `Active complaints must not include completed status, got ${c.status}`);
      assert.equal(c.isArchived, false);
    }
  });

  test('GET /api/complaints?status=Resolved in active scope returns 0 complaints', async () => {
    const res = await request(app)
      .get('/api/complaints?status=Resolved')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.complaints.length, 0);
    assert.equal(res.body.data.pagination.total, 0);
  });

  test('GET /api/complaints?completedOnly=true&status=Assigned in completed scope returns 0 complaints', async () => {
    const res = await request(app)
      .get('/api/complaints?completedOnly=true&status=Assigned')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.complaints.length, 0);
    assert.equal(res.body.data.pagination.total, 0);
  });

  test('Reopening a completed complaint moves it to active list while preserving resolution history', async () => {
    // 1. Create a resolved complaint with resolution details
    const resolvedComplaint = await Complaint.create({
      complaintNumber: 'CMP-2026-REOPEN-001',
      customerName: 'Anil Kapoor',
      customerPhone: '9876543299',
      customerAddress: 'Juhu Beach Road, Mumbai',
      subject: 'Oven door lock issue',
      productName: 'Microwave Oven',
      area: 'Juhu',
      description: 'Door lock jammed',
      status: 'Resolved',
      assignedServicer: activeServicer._id,
      servicerNameSnapshot: activeServicer.name,
      resolution: {
        workPerformed: 'Replaced door latch hook assembly',
        resolutionNotes: 'Customer tested door latch. All operational.',
        partsReplaced: 'Door Latch Hook',
        serviceCharge: 850,
        completedDate: new Date('2026-11-10'),
      },
      version: 1,
    });

    // 2. Verify it is in completed list and not active list
    const completedCheck1 = await request(app)
      .get('/api/complaints?completedOnly=true&search=CMP-2026-REOPEN-001')
      .set('Cookie', auth.cookies);
    assert.equal(completedCheck1.body.data.complaints.length, 1);

    const activeCheck1 = await request(app)
      .get('/api/complaints?search=CMP-2026-REOPEN-001')
      .set('Cookie', auth.cookies);
    assert.equal(activeCheck1.body.data.complaints.length, 0);

    // 3. Reopen ticket: PATCH status to 'In Progress'
    const reopenRes = await request(app)
      .patch(`/api/complaints/${resolvedComplaint._id}/status`)
      .set('Cookie', auth.cookies)
      .set('x-csrf-token', auth.csrfToken)
      .send({
        status: 'In Progress',
        assignedServicer: activeServicer._id.toString(),
        version: 1,
      });

    assert.equal(reopenRes.status, 200);
    assert.equal(reopenRes.body.success, true);
    assert.equal(reopenRes.body.data.status, 'In Progress');

    // 4. Verify resolution history was preserved
    const reopenedDoc = await Complaint.findById(resolvedComplaint._id);
    assert.equal(reopenedDoc.status, 'In Progress');
    assert.equal(reopenedDoc.resolution.workPerformed, 'Replaced door latch hook assembly');
    assert.equal(reopenedDoc.resolution.partsReplaced, 'Door Latch Hook');
    assert.equal(reopenedDoc.resolution.serviceCharge, 850);

    // 5. Verify it is now in active list and not completed list
    const activeCheck2 = await request(app)
      .get('/api/complaints?search=CMP-2026-REOPEN-001')
      .set('Cookie', auth.cookies);
    assert.equal(activeCheck2.body.data.complaints.length, 1);

    const completedCheck2 = await request(app)
      .get('/api/complaints?completedOnly=true&search=CMP-2026-REOPEN-001')
      .set('Cookie', auth.cookies);
    assert.equal(completedCheck2.body.data.complaints.length, 0);
  });

  test('GET /api/complaints?completedOnly=true&completedStartDate=... filters by completion date', async () => {
    const res = await request(app)
      .get('/api/complaints?completedOnly=true&completedStartDate=2026-11-01&completedEndDate=2026-11-30')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.complaints.length > 0);
  });

  test('GET /api/dashboard returns completedCount, totalActive, and recentCompletedComplaints', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.completedCount === 'number');
    assert.ok(typeof res.body.data.totalActive === 'number');
    assert.ok(Array.isArray(res.body.data.recentCompletedComplaints));
    assert.ok(Array.isArray(res.body.data.recentComplaints));
    assert.ok(res.body.data.completedCount >= 1);
    assert.ok(res.body.data.totalActive >= 1);

    // Ensure recentComplaints has no completed status
    for (const c of res.body.data.recentComplaints) {
      assert.ok(!['Resolved', 'Closed'].includes(c.status), `recentComplaints should not contain completed status, got ${c.status}`);
    }

    // Ensure recentCompletedComplaints has only completed status
    for (const c of res.body.data.recentCompletedComplaints) {
      assert.ok(['Resolved', 'Closed'].includes(c.status), `recentCompletedComplaints should only contain completed status, got ${c.status}`);
    }
  });

  test('GET /api/complaints/export/pdf exports active complaints PDF and excludes completed', async () => {
    const res = await request(app)
      .get('/api/complaints/export/pdf?exportAll=true')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(res.headers['content-disposition'].includes('sifon-service-all-active-complaints-'));
  });

  test('GET /api/complaints/export/pdf?completedOnly=true exports completed complaints PDF', async () => {
    const res = await request(app)
      .get('/api/complaints/export/pdf?completedOnly=true&exportAll=true')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(res.headers['content-disposition'].includes('sifon-service-all-completed-complaints-'));
  });
});
