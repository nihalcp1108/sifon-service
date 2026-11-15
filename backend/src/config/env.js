import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend folder regardless of whether started from repo root or backend folder
const candidateEnvPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const envPath of candidateEnvPaths) {
  dotenv.config({ path: envPath });
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

export const config = {
  appName: 'sifon-service',
  env: nodeEnv,
  isProd,
  isTest,
  port: parseInt(process.env.PORT || '5002', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rocoware',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  session: {
    cookieName: process.env.SESSION_COOKIE_NAME || 'rocoware_session',
    ttlDays: parseInt(process.env.SESSION_TTL_DAYS || '7', 10),
    secure: process.env.COOKIE_SECURE === 'true' || isProd,
    sameSite: (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase(),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  trustProxy: parseInt(process.env.TRUST_PROXY || '0', 10),
  csrfSecret: process.env.CSRF_SECRET || 'sifon_service_csrf_secret_key',
  storage: {
    driver: (process.env.UPLOAD_DRIVER || 'local').toLowerCase().trim(),
    uploadDir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || './storage/uploads'),
    maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '10', 10),
    maxAttachments: parseInt(process.env.MAX_ATTACHMENTS_PER_COMPLAINT || '10', 10),
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    }
  },
  whatsapp: {
    senderNumber: (process.env.WHATSAPP_SENDER_NUMBER || '').trim(),
    phoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    accessToken: (process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    apiVersion: (process.env.WHATSAPP_API_VERSION || 'v27.0').trim(),
    webhookVerifyToken: (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim(),
    appSecret: (process.env.WHATSAPP_APP_SECRET || '').trim(),
    defaultTemplate: (process.env.WHATSAPP_DEFAULT_TEMPLATE || 'sifon_complaint_confirmation').trim(),
    defaultLanguage: (process.env.WHATSAPP_DEFAULT_LANGUAGE || 'en_US').trim(),
  },
  adminSeed: {
    name: process.env.ADMIN_NAME || 'sifon-service Admin',
    email: (process.env.ADMIN_EMAIL || 'admin@sifon-service.local').toLowerCase().trim(),
    initialPassword: process.env.ADMIN_INITIAL_PASSWORD,
  }
};

// Validate critical config on startup
export function validateConfig() {
  if (config.storage.driver === 'cloudinary') {
    const { cloudName, apiKey, apiSecret } = config.storage.cloudinary;
    const missing = [];
    if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missing.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');

    if (missing.length > 0) {
      throw new Error(
        `Cloudinary driver selected (UPLOAD_DRIVER=cloudinary), but required configuration is missing: ${missing.join(', ')}. Please configure these in backend/.env or set UPLOAD_DRIVER=local.`
      );
    }
  }
}
