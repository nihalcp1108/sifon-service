import { config } from '../config/env.js';
import { validateSessionToken } from '../services/authService.js';

export async function requireAuth(req, res, next) {
  try {
    const rawToken = req.cookies[config.session.cookieName];
    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session missing or expired. Please log in.',
        }
      });
    }

    const result = await validateSessionToken(rawToken);
    if (!result) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session. Please log in again.',
        }
      });
    }

    req.admin = result.admin;
    req.session = result.session;
    req.sessionToken = rawToken;

    next();
  } catch (err) {
    next(err);
  }
}

