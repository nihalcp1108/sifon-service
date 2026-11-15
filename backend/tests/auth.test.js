import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupTestDB, teardownTestDB, getCsrfAndAuth, TEST_ADMIN } from './setup.js';
import { config } from '../src/config/env.js';

describe('Authentication, CSRF & Admin Settings', () => {
  let app;

  before(async () => {
    const setup = await setupTestDB();
    app = setup.app;
  });

  after(async () => {
    await teardownTestDB();
  });

  it('health check returns ok with database connected', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database, 'connected');
  });

  it('GET /api/auth/csrf returns token and sets cookie', async () => {
    const res = await request(app).get('/api/auth/csrf');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.csrfToken);
    assert.ok(res.headers['set-cookie']);
  });

  it('fails login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: 'WrongPassword' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(res.body.error.message, 'Invalid email or password');
  });

  it('succeeds login with correct credentials and returns session cookie', async () => {
    const auth = await getCsrfAndAuth(request);
    assert.ok(auth.sessionCookie);
    assert.ok(auth.csrfToken);
    assert.equal(auth.admin.email, TEST_ADMIN.email);
  });

  it('GET /api/auth/me returns admin profile when authenticated', async () => {
    const auth = await getCsrfAndAuth(request);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', auth.cookies);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.admin.email, TEST_ADMIN.email);
    assert.equal(res.body.data.admin.role, 'admin');
    assert.equal(res.body.data.admin.passwordHash, undefined); // Password hash must never be exposed
  });

  it('GET /api/auth/me rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects state mutation when CSRF token is missing or mismatched', async () => {
    const auth = await getCsrfAndAuth(request);
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', auth.cookies); // Missing X-CSRF-Token header

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'CSRF_INVALID');
  });

  it('logout revokes session and clears cookie', async () => {
    const auth = await getCsrfAndAuth(request);

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken);

    assert.equal(logoutRes.status, 200);

    // After logout, previous session cookie must be rejected
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', auth.cookies);

    assert.equal(meRes.status, 401);
  });

  it('updates admin profile name', async () => {
    const auth = await getCsrfAndAuth(request);

    const res = await request(app)
      .patch('/api/admin/profile')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({ name: 'Super Admin Updated' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.admin.name, 'Super Admin Updated');
  });

  it('changes password, hashes it, and revokes active sessions', async () => {
    const auth = await getCsrfAndAuth(request);
    const newPassword = 'NewSecretPassword2026!';

    // Rejects if new password equals current password
    const failRes = await request(app)
      .patch('/api/admin/password')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        currentPassword: TEST_ADMIN.password,
        newPassword: TEST_ADMIN.password,
        confirmPassword: TEST_ADMIN.password,
      });
    assert.equal(failRes.status, 400);

    // Succeeds with valid new password
    const successRes = await request(app)
      .patch('/api/admin/password')
      .set('Cookie', auth.cookies)
      .set('X-CSRF-Token', auth.csrfToken)
      .send({
        currentPassword: TEST_ADMIN.password,
        newPassword,
        confirmPassword: newPassword,
      });

    assert.equal(successRes.status, 200);

    // Old session must now be revoked
    const checkOldSession = await request(app)
      .get('/api/auth/me')
      .set('Cookie', auth.cookies);
    assert.equal(checkOldSession.status, 401);

    // Login with new password must succeed
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: newPassword });
    assert.equal(newLogin.status, 200);

    // Reset password back for other tests
    TEST_ADMIN.password = newPassword;
  });
});

