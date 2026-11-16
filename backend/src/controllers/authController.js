import { Admin } from '../models/Admin.js';
import { createSession, revokeSession } from '../services/authService.js';
import { setSessionCookie, clearSessionCookie } from '../utils/cookies.js';
import { generateCsrfToken, setCsrfCookie, clearCsrfCookie } from '../middleware/csrfMiddleware.js';
import { loginSchema } from '../validators/schemas.js';

export async function getCsrf(req, res) {
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.json({
    success: true,
    data: { csrfToken }
  });
}

export async function login(req, res, next) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid credentials format',
          details: parseResult.error.errors,
        }
      });
    }

    const { email, password } = parseResult.data;

    // Generic invalid credentials message
    const invalidMsg = 'Invalid email or password';

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: invalidMsg }
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: invalidMsg }
      });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const { rawToken, expiresAt } = await createSession(admin._id, ip, userAgent);

    setSessionCookie(res, rawToken, expiresAt);

    // Also issue a CSRF token upon login
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    res.json({
      success: true,
      data: {
        admin: admin.toJSON(),
        csrfToken,
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.sessionToken) {
      await revokeSession(req.sessionToken);
    }
    clearSessionCookie(res);
    clearCsrfCookie(res);
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  res.json({
    success: true,
    data: {
      admin: req.admin.toJSON(),
    }
  });
}

