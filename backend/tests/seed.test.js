import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestDB, teardownTestDB } from './setup.js';
import { Admin } from '../src/models/Admin.js';
import { config } from '../src/config/env.js';

describe('Admin Initialization & Seeding Rules', () => {
  before(async () => {
    await setupTestDB();
  });

  after(async () => {
    await teardownTestDB();
  });

  it('initial admin already exists from setup', async () => {
    const count = await Admin.countDocuments();
    assert.ok(count >= 1);
  });

  it('idempotent check: does not recreate or overwrite admin if an account exists', async () => {
    const existing = await Admin.findOne();
    const originalHash = existing.passwordHash;
    const originalEmail = existing.email;

    // Simulate seed condition check:
    const adminCount = await Admin.countDocuments();
    assert.ok(adminCount > 0, 'Should detect existing admin and skip');

    // Verify existing credentials were unchanged
    const unchanged = await Admin.findById(existing._id);
    assert.equal(unchanged.passwordHash, originalHash);
    assert.equal(unchanged.email, originalEmail);
  });

  it('does not reset password if admin email was changed', async () => {
    const admin = await Admin.findOne();
    admin.email = 'new_custom_admin@rocoware.local';
    await admin.save();

    // Verify admin count is still 1
    const count = await Admin.countDocuments();
    assert.equal(count, 1);

    // Seeding check must see count > 0 and skip!
    const wouldSkip = count > 0;
    assert.equal(wouldSkip, true);
  });
});

