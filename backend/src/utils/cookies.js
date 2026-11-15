import { config } from '../config/env.js';

export function getSessionCookieOptions(expiresAt) {
  const options = {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: config.session.sameSite,
    path: '/',
  };

  if (config.session.domain) {
    options.domain = config.session.domain;
  }

  if (expiresAt) {
    options.expires = expiresAt;
  }

  return options;
}

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(config.session.cookieName, token, getSessionCookieOptions(expiresAt));
}

export function clearSessionCookie(res) {
  const options = getSessionCookieOptions();
  res.clearCookie(config.session.cookieName, options);
}

