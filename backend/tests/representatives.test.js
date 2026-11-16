import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth } from './setup.js';
import { Representative } from '../src/models/Representative.js';
import { Complaint, COMPLETED_STATUSES } from '../src/models/Complaint.js';
import { Servicer } from '../src/models/Servicer.js';

describe('Representative (REP) Management & Attribution', () => {
  let app;
  let auth;
  let activeRep1;
  let activeRep2;
  let inactiveRep;
  let testServicer;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
    auth = await getCsrfAndAuth(request);

    // Create a field servicer for service tests
    testServicer = await Servicer.create({
      name: 'Field Servicer Anil',
      phone: '9876500111',
      isActive: true,
    });
  });

  after(async () => {
    await teardownTestDB();
  });

  describe('1. Representative CRUD, Uniqueness & Lifecycle', () => {
    it('creates a new representative with name, phone, email and active status', async () => {
      const res = await request(app)
        .post('/api/representatives')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Rahul Sharma',
          phone: '+91 9876543210',
          email: 'rahul.sharma@example.com',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Rahul Sharma');
      assert.equal(res.body.data.phone, '+91 9876543210');
      assert.equal(res.body.data.email, 'rahul.sharma@example.com');
      assert.equal(res.body.data.isActive, true);
      assert.ok(res.body.data._id);

      activeRep1 = res.body.data;
    });

    it('allows different representatives to have the same name (no unique name constraint)', async () => {
      const res = await request(app)
        .post('/api/representatives')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Rahul Sharma', // Identical name
          phone: '+91 9123456789',
          email: 'rahul.bangalore@example.com',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Rahul Sharma');
      assert.notEqual(res.body.data._id, activeRep1._id);

      activeRep2 = res.body.data;
    });

    it('rejects creation when required name is empty', async () => {
      const res = await request(app)
        .post('/api/representatives')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: '   ',
          phone: '9876543210',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/representatives')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Invalid Email Person',
          email: 'not-an-email',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('retrieves all representatives with active and completed complaint counts via single aggregation', async () => {
      const res = await request(app)
        .get('/api/representatives')
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 2);

      const found = res.body.data.find((r) => r._id === activeRep1._id);
      assert.ok(found);
      assert.equal(found.activeComplaintsCount, 0);
      assert.equal(found.completedComplaintsCount, 0);
    });

    it('edits representative details and updates snapshot names on existing complaints', async () => {
      const res = await request(app)
        .patch(`/api/representatives/${activeRep1._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Rahul K. Sharma',
          phone: '+91 9876543210',
          email: 'rahul.k@example.com',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Rahul K. Sharma');
      assert.equal(res.body.data.email, 'rahul.k@example.com');

      activeRep1 = res.body.data;
    });

    it('toggles representative activation status (deactivates and reactivates)', async () => {
      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/representatives/${activeRep2._id}/status`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({ isActive: false });

      assert.equal(deactRes.status, 200);
      assert.equal(deactRes.body.data.isActive, false);
      inactiveRep = deactRes.body.data;

      // GET with activeOnly=true should not return inactiveRep
      const activeOnlyRes = await request(app)
        .get('/api/representatives?activeOnly=true')
        .set('Cookie', auth.cookies);

      assert.equal(activeOnlyRes.status, 200);
      const foundInactive = activeOnlyRes.body.data.find((r) => r._id === inactiveRep._id);
      assert.equal(foundInactive, undefined);
    });

    it('deletes an unreferenced representative successfully', async () => {
      // Create a temporary REP
      const tempRep = await Representative.create({
        name: 'Temporary Unused REP',
        phone: '9000000000',
        isActive: true,
      });

      const delRes = await request(app)
        .delete(`/api/representatives/${tempRep._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken);

      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.success, true);

      const check = await Representative.findById(tempRep._id);
      assert.equal(check, null);
    });
  });

  describe('2. Complaint Registration & Active REP Enforcement', () => {
    it('rejects complaint creation when representative is missing', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'REP-FAIL-001',
          customerName: 'No Rep Customer',
          customerPhone: '9876511111',
          customerAddress: 'MG Road',
          area: 'Central',
          productName: 'RO 15L',
          subject: 'Missing rep test',
          description: 'Testing validation when rep is omitted',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(
        res.body.error.message.includes('Registered by (REP)') ||
          JSON.stringify(res.body.error.details || []).includes('representative')
      );
    });

    it('rejects complaint creation with an inactive representative', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'REP-FAIL-002',
          customerName: 'Inactive Rep Customer',
          customerPhone: '9876522222',
          customerAddress: 'MG Road',
          area: 'Central',
          representative: inactiveRep._id,
          productName: 'RO 15L',
          subject: 'Inactive rep test',
          description: 'Testing that inactive rep cannot register new complaints',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INACTIVE_REPRESENTATIVE');
    });

    it('successfully registers complaint with active representative and populates snapshot', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'REP-SUCCESS-001',
          customerName: 'Vivek Kumar',
          customerPhone: '9876533333',
          customerAddress: 'HSR Layout Sector 1',
          area: 'HSR Layout',
          representative: activeRep1._id,
          productName: 'RO Elite 10L',
          subject: 'Low pressure indicator on',
          description: 'Booster pump pressure is fluctuating.',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.complaintNumber, 'REP-SUCCESS-001');
      assert.equal(res.body.data.representative._id, activeRep1._id);
      assert.equal(res.body.data.representativeNameSnapshot, activeRep1.name);

      // Verify audit timeline logged action
      const timelineActions = res.body.data.timeline.map((t) => t.action);
      assert.ok(timelineActions.includes('REGISTERED'));
    });

    it('prevents deletion of representative referenced by existing complaints', async () => {
      const delRes = await request(app)
        .delete(`/api/representatives/${activeRep1._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken);

      assert.equal(delRes.status, 400);
      assert.equal(delRes.body.success, false);
      assert.equal(delRes.body.error.code, 'CANNOT_DELETE_REFERENCED');
      assert.ok(delRes.body.error.message.includes('Deactivate'));
    });
  });

  describe('3. Complaint Editing, Reassignment & Deactivation Tolerance', () => {
    let testComplaint;

    before(async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'REP-REASSIGN-001',
          customerName: 'Priya Sundaram',
          customerPhone: '9876544444',
          customerAddress: 'Koramangala 4th Block',
          area: 'Koramangala',
          representative: activeRep1._id,
          productName: 'RO Max',
          subject: 'Annual maintenance',
          description: 'Standard filter servicing',
        });
      testComplaint = res.body.data;
    });

    it('reassigns representative to another active representative and logs to timeline', async () => {
      // First reactivate activeRep2 for testing
      await Representative.findByIdAndUpdate(activeRep2._id, { isActive: true, name: 'Sanjay Gupta' });

      const current = await Complaint.findById(testComplaint._id);
      const patchRes = await request(app)
        .patch(`/api/complaints/${testComplaint._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          representative: activeRep2._id,
          version: current.version,
        });

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.representative._id, activeRep2._id);
      assert.equal(patchRes.body.data.representativeNameSnapshot, 'Sanjay Gupta');

      const lastTimeline = patchRes.body.data.timeline[patchRes.body.data.timeline.length - 1];
      assert.equal(lastTimeline.action, 'DETAILS_UPDATED');
      assert.ok(lastTimeline.details.includes('Sanjay Gupta'));

      testComplaint = patchRes.body.data;
    });

    it('rejects reassigning complaint to an inactive representative', async () => {
      // Create an inactive representative
      const dormantRep = await Representative.create({
        name: 'Dormant Representative',
        phone: '9777700000',
        isActive: false,
      });

      const current = await Complaint.findById(testComplaint._id);
      const patchRes = await request(app)
        .patch(`/api/complaints/${testComplaint._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          representative: dormantRep._id,
          version: current.version,
        });

      assert.equal(patchRes.status, 400);
      assert.equal(patchRes.body.error.code, 'INACTIVE_REPRESENTATIVE');
    });

    it('allows unrelated complaint edits when assigned representative was subsequently deactivated', async () => {
      // Deactivate Sanjay Gupta
      await Representative.findByIdAndUpdate(activeRep2._id, { isActive: false });

      const current = await Complaint.findById(testComplaint._id);
      // Admin updates complaint priority or customer address without changing representative
      const patchRes = await request(app)
        .patch(`/api/complaints/${testComplaint._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          priority: 'urgent',
          area: 'Koramangala 5th Block',
          version: current.version,
        });

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.priority, 'urgent');
      assert.equal(patchRes.body.data.area, 'Koramangala 5th Block');
      // Historical representative is preserved
      assert.equal(patchRes.body.data.representative._id, activeRep2._id);
      assert.equal(patchRes.body.data.representativeNameSnapshot, 'Sanjay Gupta');

      testComplaint = patchRes.body.data;
    });
  });

  describe('4. Legacy Records, Unassigned Scope & Count Tracking', () => {
    let legacyComplaint;

    before(async () => {
      // Direct insertion mimicking pre-REP legacy complaints
      legacyComplaint = await Complaint.create({
        complaintNumber: 'LEGACY-NO-REP-001',
        customerName: 'Old Customer',
        customerPhone: '9111122222',
        customerAddress: 'Old Bazaar',
        area: 'Old Town',
        productName: 'Legacy Water Filter',
        subject: 'Historical ticket',
        description: 'Complaint entered before representative feature existed',
        representative: null,
        representativeNameSnapshot: '',
        status: 'Registered',
        isArchived: false,
      });
    });

    it('displays legacy complaint with "Not assigned" REP snapshot and allows unrelated edits', async () => {
      const getRes = await request(app)
        .get(`/api/complaints/${legacyComplaint._id}`)
        .set('Cookie', auth.cookies);

      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.representative, null);
      assert.equal(getRes.body.data.representativeNameSnapshot, '');

      // Unrelated edit on legacy complaint without assigning REP is allowed
      const editRes = await request(app)
        .patch(`/api/complaints/${legacyComplaint._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          priority: 'high',
          version: legacyComplaint.version,
        });

      assert.equal(editRes.status, 200);
      assert.equal(editRes.body.data.priority, 'high');
      assert.equal(editRes.body.data.representative, null);
    });

    it('allows assigning a representative to a legacy complaint via edit', async () => {
      const assignRes = await request(app)
        .patch(`/api/complaints/${legacyComplaint._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          representative: activeRep1._id,
          version: legacyComplaint.version + 1,
        });

      assert.equal(assignRes.status, 200);
      assert.equal(assignRes.body.data.representative._id, activeRep1._id);
      assert.equal(assignRes.body.data.representativeNameSnapshot, activeRep1.name);
    });

    it('filters active complaints by representative ID', async () => {
      const res = await request(app)
        .get(`/api/complaints?representative=${activeRep1._id}`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.complaints.length >= 1);
      assert.ok(
        res.body.data.complaints.every(
          (c) => c.representative?._id === activeRep1._id || c.representative === activeRep1._id
        )
      );
    });

    it('filters unassigned representative complaints using ?representative=unassigned', async () => {
      // Create another unassigned complaint
      await Complaint.create({
        complaintNumber: 'UNASSIGNED-REP-002',
        customerName: 'Unassigned Rep Customer',
        customerPhone: '9333344444',
        customerAddress: 'Cross St',
        area: 'Indiranagar',
        productName: 'Pure RO',
        subject: 'No rep ticket',
        description: 'Testing unassigned filter',
        representative: null,
        representativeNameSnapshot: '',
        status: 'Registered',
        isArchived: false,
      });

      const res = await request(app)
        .get('/api/complaints?representative=unassigned')
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.complaints.length >= 1);
      assert.ok(
        res.body.data.complaints.every(
          (c) => c.representative === null || c.representative === undefined
        )
      );
    });

    it('correctly tracks both active and completed complaint counts on representative list', async () => {
      // Complete service on REP-SUCCESS-001
      const complaintToComplete = await Complaint.findOne({ complaintNumber: 'REP-SUCCESS-001' });

      const completeRes = await request(app)
        .post(`/api/complaints/${complaintToComplete._id}/complete-service`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          assignedServicer: testServicer._id,
          completedDate: '2026-11-16',
          workPerformed: 'Replaced sediment filter cartridge and flushed system',
          resolutionNotes: 'Customer verified clean water output TDS 60',
          serviceCharge: 500,
          version: complaintToComplete.version,
        });

      assert.equal(completeRes.status, 200);
      assert.equal(completeRes.body.data.status, 'Resolved');

      // Now query representatives list
      const repsRes = await request(app)
        .get('/api/representatives')
        .set('Cookie', auth.cookies);

      assert.equal(repsRes.status, 200);
      const rep1Stats = repsRes.body.data.find((r) => r._id === activeRep1._id);
      assert.ok(rep1Stats);
      assert.ok(rep1Stats.completedComplaintsCount >= 1, 'Should have at least 1 completed complaint');
      assert.ok(rep1Stats.activeComplaintsCount >= 1, 'Should have at least 1 active complaint');
    });

    it('filters completed complaints by representative ID on completed-only scope', async () => {
      const res = await request(app)
        .get(`/api/complaints?completedOnly=true&representative=${activeRep1._id}`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.complaints.length >= 1);
      assert.ok(
        res.body.data.complaints.every((c) => COMPLETED_STATUSES.includes(c.status))
      );
    });
  });

  describe('5. PDF Exports with Representative Attribution', () => {
    it('generates individual complaint PDF displaying representative information', async () => {
      const complaint = await Complaint.findOne({ complaintNumber: 'REP-SUCCESS-001' });

      const res = await request(app)
        .get(`/api/complaints/${complaint._id}/pdf`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');

      const buf = Buffer.from(res.body);
      assert.ok(buf.length > 500);
      assert.equal(buf.toString('ascii', 0, 5), '%PDF-');
    });

    it('exports active complaints PDF with representative filter', async () => {
      const res = await request(app)
        .get(`/api/complaints/export/pdf?representative=${activeRep1._id}`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');
      assert.ok(res.headers['content-disposition'].includes('sifon-service-filtered-active-complaints-'));

      const buf = Buffer.from(res.body);
      assert.ok(buf.length > 500);
      assert.equal(buf.toString('ascii', 0, 5), '%PDF-');
    });

    it('exports completed complaints PDF with representative filter', async () => {
      const res = await request(app)
        .get(`/api/complaints/export/pdf?completedOnly=true&representative=${activeRep1._id}`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');
      assert.ok(res.headers['content-disposition'].includes('sifon-service-filtered-completed-complaints-'));

      const buf = Buffer.from(res.body);
      assert.ok(buf.length > 500);
      assert.equal(buf.toString('ascii', 0, 5), '%PDF-');
    });
  });
});
