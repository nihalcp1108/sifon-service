import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth, TEST_ADMIN } from './setup.js';
import { config } from '../src/config/env.js';
import { Session } from '../src/models/Session.js';
import { hashToken } from '../src/services/authService.js';

describe('Production Session Authentication & Protected Endpoints', () => {
  let app;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
  });

  after(async () => {
    await teardownTestDB();
  });

  it('login returns 200, sets session cookie with HttpOnly, and persists session in MongoDB', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.admin.email, TEST_ADMIN.email);

    // Verify Set-Cookie headers
    const setCookies = res.headers['set-cookie'];
    assert.ok(Array.isArray(setCookies) && setCookies.length > 0);

    const sessionCookieStr = setCookies.find(c => c.startsWith(`${config.session.cookieName}=`));
    assert.ok(sessionCookieStr, `Should set cookie starting with ${config.session.cookieName}=`);
    assert.ok(sessionCookieStr.includes('HttpOnly') || sessionCookieStr.includes('httponly'));
    assert.ok(sessionCookieStr.includes('Path=/') || sessionCookieStr.includes('path=/'));

    // Extract token value
    const rawToken = sessionCookieStr.split(';')[0].split('=')[1];
    assert.ok(rawToken.length >= 32);

    // Verify session was persisted in MongoDB
    const tokenHash = hashToken(rawToken);
    const sessionInDb = await Session.findOne({ tokenHash });
    assert.ok(sessionInDb, 'Session document must exist in MongoDB');
    assert.ok(sessionInDb.expiresAt > new Date(), 'Session expiresAt must be in the future');
  });

  it('all listed protected endpoints return 200 when authenticated', async () => {
    const auth = await getCsrfAndAuth(request);

    const protectedEndpoints = [
      '/api/auth/me',
      '/api/dashboard',
      '/api/categories',
      '/api/brands',
      '/api/complaints',
      '/api/servicers',
    ];

    for (const endpoint of protectedEndpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Cookie', auth.cookies);

      assert.equal(
        res.status,
        200,
        `Endpoint ${endpoint} should return 200 with valid session cookie, got ${res.status}: ${JSON.stringify(res.body)}`
      );
      assert.equal(res.body.success, true);
    }
  });

  it('all listed protected endpoints return 401 with exact error message when unauthenticated', async () => {
    const protectedEndpoints = [
      '/api/auth/me',
      '/api/dashboard',
      '/api/categories',
      '/api/brands',
      '/api/complaints',
      '/api/servicers',
    ];

    for (const endpoint of protectedEndpoints) {
      const res = await request(app).get(endpoint);

      assert.equal(
        res.status,
        401,
        `Endpoint ${endpoint} should return 401 when session cookie is absent, got ${res.status}`
      );
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.equal(res.body.error.message, 'Session missing or expired. Please log in.');
    }
  });

  it('returns 401 "Invalid or expired session. Please log in again." when session token is invalid or expired', async () => {
    // 1. Invalid fake token
    const fakeCookie = `${config.session.cookieName}=deadbeefdeadbeefdeadbeefdeadbeef; Path=/; HttpOnly`;
    const res1 = await request(app)
      .get('/api/dashboard')
      .set('Cookie', fakeCookie);

    assert.equal(res1.status, 401);
    assert.equal(res1.body.error.code, 'UNAUTHORIZED');
    assert.equal(res1.body.error.message, 'Invalid or expired session. Please log in again.');

    // 2. Expired token in database
    const auth = await getCsrfAndAuth(request);
    const rawToken = auth.sessionCookie.split('=')[1];
    const tokenHash = hashToken(rawToken);

    // Force expired date
    await Session.updateOne({ tokenHash }, { expiresAt: new Date(Date.now() - 60000) });

    const res2 = await request(app)
      .get('/api/dashboard')
      .set('Cookie', auth.cookies);

    assert.equal(res2.status, 401);
    assert.equal(res2.body.error.code, 'UNAUTHORIZED');
    assert.equal(res2.body.error.message, 'Invalid or expired session. Please log in again.');
  });

  it('accepts session token under fallback cookie names (sifon-service, sifon_service_session, rocoware_session)', async () => {
    const auth = await getCsrfAndAuth(request);
    const rawToken = auth.sessionCookie.split('=')[1];

    const fallbackNames = ['sifon-service', 'sifon_service_session', 'rocoware_session'];

    for (const name of fallbackNames) {
      const customCookie = `${name}=${rawToken}`;
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', customCookie);

      assert.equal(res.status, 200, `Should authenticate with cookie name: ${name}`);
      assert.equal(res.body.data.admin.email, TEST_ADMIN.email);
    }
  });

  it('logout destroys session in database and clears session cookies', async () => {
    const auth = await getCsrfAndAuth(request);
    const rawToken = auth.sessionCookie.split('=')[1];
    const tokenHash = hashToken(rawToken);

    // Verify session exists in DB before logout
    const beforeLogout = await Session.findOne({ tokenHash });
    assert.ok(beforeLogout, 'Session must exist before logout');

    // Perform logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken);

    assert.equal(logoutRes.status, 200);

    // Verify session was deleted from DB
    const afterLogout = await Session.findOne({ tokenHash });
    assert.equal(afterLogout, null, 'Session must be deleted from MongoDB after logout');

    // Subsequent protected requests must now fail with 401
    const testEndpoints = ['/api/dashboard', '/api/categories', '/api/brands', '/api/complaints', '/api/servicers'];
    for (const ep of testEndpoints) {
      const res = await request(app)
        .get(ep)
        .set('Cookie', auth.cookies);
      assert.equal(res.status, 401);
    }
  });

  it('sessions survive and are retrievable across separate database lookups', async () => {
    const auth = await getCsrfAndAuth(request);
    const rawToken = auth.sessionCookie.split('=')[1];
    const tokenHash = hashToken(rawToken);

    // Query DB directly
    const session = await Session.findOne({ tokenHash }).populate('userId');
    assert.ok(session);
    assert.equal(session.userId.email, TEST_ADMIN.email);

    // Verify another request still succeeds
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', auth.cookies);
    assert.equal(res.status, 200);
  });

  it('refresh preserves login across repeated requests with the same session cookie', async () => {
    const auth = await getCsrfAndAuth(request);

    // Simulate page refresh: first calls /auth/me, then /dashboard, then /complaints
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', auth.cookies);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.admin.email, TEST_ADMIN.email);

    const dashboardRes = await request(app)
      .get('/api/dashboard')
      .set('Cookie', auth.cookies);
    assert.equal(dashboardRes.status, 200);

    const complaintsRes = await request(app)
      .get('/api/complaints')
      .set('Cookie', auth.cookies);
    assert.equal(complaintsRes.status, 200);
  });

  it('CSRF-protected mutations succeed when both cookie and header are provided', async () => {
    const auth = await getCsrfAndAuth(request);

    const res = await request(app)
      .patch('/api/admin/profile')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({ name: 'Admin Name Updated' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.admin.name, 'Admin Name Updated');
  });
});

