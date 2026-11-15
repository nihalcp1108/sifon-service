import crypto from 'crypto';
import { config } from '../config/env.js';

const CSRF_COOKIE_NAME = 'rocoware_csrf';

export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Frontend JavaScript needs to read this or receive from /api/auth/csrf
    secure: config.session.secure,
    sameSite: config.session.sameSite,
    path: '/',
    domain: config.session.domain,
  });
}

export function csrfProtection(req, res, next) {
  // Allow safe HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check Origin or Referer if present
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  if (origin) {
    const isAllowedOrigin = config.corsOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = new URL(origin);
        return allowedUrl.origin === originUrl.origin;
      } catch {
        return false;
      }
    });

    // In dev, also allow if host matches
    const hostHeader = req.headers.host;
    const isHostMatch = origin.includes(hostHeader);

    if (!isAllowedOrigin && !isHostMatch && config.isProd) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_ORIGIN_REJECTED',
          message: 'Origin header does not match allowed CORS origins',
        }
      });
    }
  }

  // Verify CSRF token from header vs cookie
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies[CSRF_COOKIE_NAME];

  // If testing or CSRF token is provided, verify match
  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_INVALID',
        message: 'Invalid or missing CSRF token. Please refresh and try again.',
      }
    });
  }

  next();
}

