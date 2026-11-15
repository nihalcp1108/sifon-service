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
  const options = getSessionCookieOptions(expiresAt);
  res.cookie(config.session.cookieName, token, options);
}

export function clearSessionCookie(res) {
  const options = getSessionCookieOptions();
  res.clearCookie(config.session.cookieName, options);
  if (config.session.cookieName !== 'sifon-service') {
    res.clearCookie('sifon-service', options);
  }
  if (config.session.cookieName !== 'rocoware_session') {
    res.clearCookie('rocoware_session', options);
  }
}

