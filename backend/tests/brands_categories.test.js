import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth } from './setup.js';
import { Brand } from '../src/models/Brand.js';
import { Category } from '../src/models/Category.js';

describe('Brand & Category Management & PDF Reports', () => {
  let app;
  let auth;
  let testBrand;
  let testCategory;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
    auth = await getCsrfAndAuth(request);
  });

  after(async () => {
    await teardownTestDB();
  });

  describe('Brand Management', () => {
    it('creates a new brand and enforces case-insensitive uniqueness', async () => {
      // 1. Create Brand
      const res = await request(app)
        .post('/api/brands')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Kent RO',
          description: 'Water filtration systems',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.name, 'Kent RO');
      assert.equal(res.body.data.isActive, true);
      testBrand = res.body.data;

      // 2. Reject case-insensitive duplicate ("kent ro")
      const dupRes = await request(app)
        .post('/api/brands')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'kent ro',
          description: 'Duplicate attempt',
        });

      assert.equal(dupRes.status, 400);
      assert.equal(dupRes.body.error.code, 'DUPLICATE_BRAND');
    });

    it('rejects blank brand name', async () => {
      const res = await request(app)
        .post('/api/brands')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: '   ',
          description: 'Empty name test',
        });

      assert.equal(res.status, 400);
    });

    it('lists brands with complaint counts', async () => {
      const res = await request(app)
        .get('/api/brands')
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      const found = res.body.data.find(b => b._id === testBrand._id);
      assert.ok(found);
      assert.equal(typeof found.complaintsCount, 'number');
    });

    it('edits a brand name and description', async () => {
      const res = await request(app)
        .patch(`/api/brands/${testBrand._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Kent RO Healthcare',
          description: 'Updated brand description',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, 'Kent RO Healthcare');
      assert.equal(res.body.data.description, 'Updated brand description');
    });

    it('toggles brand activation status', async () => {
      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/brands/${testBrand._id}/status`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken);

      assert.equal(deactRes.status, 200);
      assert.equal(deactRes.body.data.isActive, false);

      // Reactivate
      const reactRes = await request(app)
        .patch(`/api/brands/${testBrand._id}/status`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken);

      assert.equal(reactRes.status, 200);
      assert.equal(reactRes.body.data.isActive, true);
    });

    it('downloads brand-specific complaints PDF report', async () => {
      // Create a complaint assigned to this brand
      await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'BRAND-PDF-001',
          customerName: 'Brand Test Customer',
          customerPhone: '9876543299',
          customerAddress: 'Brand St',
          area: 'West Zone',
          brand: testBrand._id,
          productName: 'Kent Grand Plus',
          subject: 'Brand PDF Test Issue',
          description: 'Testing brand-specific PDF export report',
        });

      const res = await request(app)
        .get(`/api/brands/${testBrand._id}/complaints/pdf`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');
      assert.ok(res.headers['content-disposition'].includes('sifon-service-brand-'));

      const buffer = Buffer.from(res.body);
      assert.ok(buffer.length > 500);
      assert.equal(buffer.toString('ascii', 0, 5), '%PDF-');
    });
  });

  describe('Category Management', () => {
    it('creates a new category and enforces case-insensitive uniqueness', async () => {
      // 1. Create Category
      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Commercial RO Plant',
          description: 'High capacity water treatment plants',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.name, 'Commercial RO Plant');
      assert.equal(res.body.data.isActive, true);
      testCategory = res.body.data;

      // 2. Reject case-insensitive duplicate ("commercial ro plant")
      const dupRes = await request(app)
        .post('/api/categories')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'commercial ro plant',
          description: 'Duplicate category attempt',
        });

      assert.equal(dupRes.status, 400);
      assert.equal(dupRes.body.error.code, 'DUPLICATE_CATEGORY');
    });

    it('rejects blank category name', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: '   ',
          description: 'Empty category name test',
        });

      assert.equal(res.status, 400);
    });

    it('lists categories with complaint counts', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      const found = res.body.data.find(c => c._id === testCategory._id);
      assert.ok(found);
      assert.equal(typeof found.complaintsCount, 'number');
    });

    it('edits a category name and description', async () => {
      const res = await request(app)
        .patch(`/api/categories/${testCategory._id}`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          name: 'Industrial RO System',
          description: 'Updated industrial category notes',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, 'Industrial RO System');
      assert.equal(res.body.data.description, 'Updated industrial category notes');
    });

    it('toggles category activation status', async () => {
      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/categories/${testCategory._id}/status`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken);

      assert.equal(deactRes.status, 200);
      assert.equal(deactRes.body.data.isActive, false);

      // Reactivate
      const reactRes = await request(app)
        .patch(`/api/categories/${testCategory._id}/status`)
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken);

      assert.equal(reactRes.status, 200);
      assert.equal(reactRes.body.data.isActive, true);
    });

    it('downloads category-specific complaints PDF report', async () => {
      // Create a complaint assigned to this category
      await request(app)
        .post('/api/complaints')
        .set('Cookie', auth.cookies)
        .set('X-CSRF-Token', auth.csrfToken)
        .send({
          complaintNumber: 'CAT-PDF-001',
          customerName: 'Category Test Customer',
          customerPhone: '9876543288',
          customerAddress: 'Industrial Zone 4',
          area: 'Peenya',
          category: testCategory._id,
          productName: '1000 LPH RO Plant',
          subject: 'Category PDF Test Issue',
          description: 'Testing category-specific PDF export report',
        });

      const res = await request(app)
        .get(`/api/categories/${testCategory._id}/complaints/pdf`)
        .set('Cookie', auth.cookies);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');
      assert.ok(res.headers['content-disposition'].includes('sifon-service-category-'));

      const buffer = Buffer.from(res.body);
      assert.ok(buffer.length > 500);
      assert.equal(buffer.toString('ascii', 0, 5), '%PDF-');
    });
  });
});

