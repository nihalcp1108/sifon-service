import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { Admin } from '../src/models/Admin.js';
import { config } from '../src/config/env.js';

let mongod;
export let app;

export const TEST_ADMIN = {
  name: 'Test Administrator',
  email: 'admin@test.local',
  password: 'Password123!',
};

export async function setupTestDB() {
  process.env.NODE_ENV = 'test';
  config.session.secure = false;
  
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  app = createApp();

  // Create initial admin
  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, 8);
  const admin = await Admin.create({
    name: TEST_ADMIN.name,
    email: TEST_ADMIN.email,
    passwordHash,
    role: 'admin',
  });

  return { app, admin };
}

export async function teardownTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
}

export async function getCsrfAndAuth(request) {
  // 1. Get CSRF
  const csrfRes = await request(app).get('/api/auth/csrf');
  const csrfToken = csrfRes.body.data.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0];

  // 2. Login
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });

  const sessionCookie = loginRes.headers['set-cookie']?.find(c => c.startsWith(config.session.cookieName))?.split(';')[0];
  const returnedCsrf = loginRes.body.data?.csrfToken || csrfToken;

  return {
    csrfToken: returnedCsrf,
    sessionCookie,
    csrfCookie,
    cookies: [sessionCookie, `sifon_csrf=${returnedCsrf}`, `rocoware_csrf=${returnedCsrf}`].filter(Boolean).join('; '),
    admin: loginRes.body.data?.admin,
  };
}

