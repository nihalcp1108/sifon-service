import crypto from 'crypto';
import { Admin } from '../models/Admin.js';
import { Session } from '../models/Session.js';
import { config } from '../config/env.js';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId, ip = '', userAgent = '') {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + config.session.ttlDays * 24 * 60 * 60 * 1000);

  const session = await Session.create({
    tokenHash,
    userId,
    expiresAt,
    ip,
    userAgent,
    lastActiveAt: new Date(),
  });

  return {
    rawToken,
    session,
    expiresAt,
  };
}

export async function validateSessionToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const session = await Session.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).populate('userId');

  if (!session || !session.userId) {
    return null;
  }

  // Update last active asynchronously
  Session.updateOne({ _id: session._id }, { lastActiveAt: new Date() }).exec().catch(() => {});

  return {
    session,
    admin: session.userId,
  };
}

export async function revokeSession(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await Session.deleteOne({ tokenHash });
}

export async function revokeAllUserSessions(userId) {
  await Session.deleteMany({ userId });
}

