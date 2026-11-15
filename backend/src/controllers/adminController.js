import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin.js';
import { revokeAllUserSessions } from '../services/authService.js';
import { clearSessionCookie } from '../utils/cookies.js';
import {
  updateProfileSchema,
  updateEmailSchema,
  updatePasswordSchema,
} from '../validators/schemas.js';

export async function updateProfile(req, res, next) {
  try {
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid profile data',
          details: parseResult.error.errors,
        }
      });
    }

    const { name } = parseResult.data;
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Admin not found' } });
    }

    admin.name = name;
    await admin.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        admin: admin.toJSON(),
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateEmail(req, res, next) {
  try {
    const parseResult = updateEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email update data',
          details: parseResult.error.errors,
        }
      });
    }

    const { newEmail, currentPassword } = parseResult.data;
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Admin not found' } });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Incorrect current password',
        }
      });
    }

    // Verify uniqueness
    if (newEmail === admin.email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SAME_EMAIL',
          message: 'New email cannot be identical to current email',
        }
      });
    }

    const existing = await Admin.findOne({ email: newEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Email address is already in use',
        }
      });
    }

    admin.email = newEmail;
    await admin.save();

    // Revoke all existing sessions and clear session cookie
    await revokeAllUserSessions(admin._id);
    clearSessionCookie(res);

    res.json({
      success: true,
      message: 'Email updated successfully. Please log in with your new email.',
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePassword(req, res, next) {
  try {
    const parseResult = updatePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid password parameters',
          details: parseResult.error.errors,
        }
      });
    }

    const { currentPassword, newPassword } = parseResult.data;
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Admin not found' } });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Incorrect current password',
        }
      });
    }

    // Hash and store new password
    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    await admin.save();

    // Revoke all sessions
    await revokeAllUserSessions(admin._id);
    clearSessionCookie(res);

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

