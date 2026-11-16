import crypto from 'crypto';
import { config } from '../config/env.js';

export const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'sifon_csrf';

export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function setCsrfCookie(res, token) {
  const options = {
    httpOnly: false, // Frontend JavaScript needs to read this or receive from /api/auth/csrf
    secure: config.session.secure,
    sameSite: config.session.sameSite,
    path: '/',
  };

  if (config.session.domain) {
    options.domain = config.session.domain;
  }

  res.cookie(CSRF_COOKIE_NAME, token, options);
  // Also set legacy cookie name for backwards compatibility
  res.cookie('rocoware_csrf', token, options);
}

export function clearCsrfCookie(res) {
  const options = {
    httpOnly: false,
    secure: config.session.secure,
    sameSite: config.session.sameSite,
    path: '/',
  };

  if (config.session.domain) {
    options.domain = config.session.domain;
  }

  res.clearCookie(CSRF_COOKIE_NAME, options);
  res.clearCookie('rocoware_csrf', options);
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
        if (allowed === '*' || allowed === origin) return true;
        const allowedUrl = new URL(allowed);
        const originUrl = new URL(origin);
        return allowedUrl.origin === originUrl.origin;
      } catch {
        return false;
      }
    });

    // In direct same-origin requests, verify if origin matches current host header
    if (!isAllowedOrigin) {
      try {
        const originUrl = new URL(origin);
        const hostHeader = req.get('host');
        if (hostHeader && originUrl.host === hostHeader) {
          isAllowedOrigin = true;
        }
      } catch {
        // ignore invalid URL parsing
      }
    }

    if (!isAllowedOrigin && config.isProd) {
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
  const tokenFromCookie = req.cookies?.[CSRF_COOKIE_NAME] || req.cookies?.['sifon_csrf'] || req.cookies?.['rocoware_csrf'];

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

