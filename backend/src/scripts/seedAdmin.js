import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { config } from '../config/env.js';
import { Admin } from '../models/Admin.js';

async function seedAdmin() {
  try {
    console.log('[Seed] Connecting to database...');
    await connectDB();

    const existingAdminCount = await Admin.countDocuments();
    if (existingAdminCount > 0) {
      console.log('[Seed] An administrator account already exists. Seeding skipped to protect credentials and data.');
      await disconnectDB();
      process.exit(0);
    }

    const { name, email, initialPassword } = config.adminSeed;

    if (!email || !initialPassword) {
      console.error('[Seed Error] ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD must be defined in environment.');
      await disconnectDB();
      process.exit(1);
    }

    if (initialPassword.length < 8) {
      console.error('[Seed Error] ADMIN_INITIAL_PASSWORD must be at least 8 characters long.');
      await disconnectDB();
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(initialPassword, 12);

    const admin = await Admin.create({
      name: name || 'sifon-service Admin',
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'admin',
    });

    console.log(`[Seed] Administrator account successfully initialized for: ${admin.email}`);
    console.log('[Seed] Initial password configured from environment variable ADMIN_INITIAL_PASSWORD.');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error] Failed to seed administrator:', err.message);
    try {
      await disconnectDB();
    } catch {}
    process.exit(1);
  }
}

seedAdmin();

