import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { Complaint } from '../models/Complaint.js';
import { Brand } from '../models/Brand.js';
import { Category } from '../models/Category.js';

/**
 * Non-destructive migration script for sifon-service:
 * 1. Checks existing Complaint records for duplicate complaint numbers.
 * 2. Backfills `complaintNumberLower` on legacy complaints where it is unset.
 * 3. Inspects Brand and Category collections for case-insensitive duplicates.
 * 4. Supports --dry-run to preview actions without writing to the database.
 */
async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`[Migration] Starting sifon-service database inspection & migration (Dry Run: ${isDryRun})...`);
  await connectDB();

  try {
    // 1. Inspect Complaints
    const complaints = await Complaint.find({}).lean();
    console.log(`[Migration] Found ${complaints.length} total complaint records.`);

    const seenNumbers = new Map();
    const duplicates = [];
    const needsBackfill = [];

    for (const c of complaints) {
      if (!c.complaintNumber) {
        console.warn(`[Warning] Complaint ${c._id} is missing a complaintNumber!`);
        continue;
      }

      const lower = c.complaintNumber.toLowerCase();
      if (seenNumbers.has(lower)) {
        duplicates.push({ id1: seenNumbers.get(lower), id2: c._id, number: c.complaintNumber });
      } else {
        seenNumbers.set(lower, c._id);
      }

      if (!c.complaintNumberLower) {
        needsBackfill.push(c);
      }
    }

    if (duplicates.length > 0) {
      console.error(`[Error] Found ${duplicates.length} duplicate complaint number collisions:`, duplicates);
      console.error('[Action Required] Resolve collisions manually before applying unique constraints.');
    } else {
      console.log('[Migration] No complaint number collisions detected.');
    }

    console.log(`[Migration] Complaints requiring complaintNumberLower backfill: ${needsBackfill.length}`);

    if (!isDryRun && needsBackfill.length > 0) {
      let updatedCount = 0;
      for (const c of needsBackfill) {
        await Complaint.updateOne(
          { _id: c._id },
          { $set: { complaintNumberLower: c.complaintNumber.toLowerCase() } }
        );
        updatedCount++;
      }
      console.log(`[Migration] Successfully backfilled ${updatedCount} complaints.`);
    }

    // 2. Inspect Brands
    const brands = await Brand.find({}).lean();
    console.log(`[Migration] Found ${brands.length} brand records.`);
    const seenBrands = new Set();
    for (const b of brands) {
      const lower = (b.nameLower || b.name || '').toLowerCase();
      if (seenBrands.has(lower)) {
        console.warn(`[Warning] Duplicate brand name detected: "${b.name}" (ID: ${b._id})`);
      } else {
        seenBrands.add(lower);
      }
    }

    // 3. Inspect Categories
    const categories = await Category.find({}).lean();
    console.log(`[Migration] Found ${categories.length} category records.`);
    const seenCategories = new Set();
    for (const cat of categories) {
      const lower = (cat.nameLower || cat.name || '').toLowerCase();
      if (seenCategories.has(lower)) {
        console.warn(`[Warning] Duplicate category name detected: "${cat.name}" (ID: ${cat._id})`);
      } else {
        seenCategories.add(lower);
      }
    }

    console.log('[Migration] Migration check completed successfully.');
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

runMigration();

