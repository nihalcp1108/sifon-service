import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';

// Allowed MIME types and extensions
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
]);

// Initialize Cloudinary if credentials exist
let isCloudinaryConfigured = false;

export function initCloudinary(customConfig = null) {
  const creds = customConfig || config.storage.cloudinary;
  if (creds && creds.cloudName && creds.apiKey && creds.apiSecret) {
    cloudinary.config({
      cloud_name: creds.cloudName,
      api_key: creds.apiKey,
      api_secret: creds.apiSecret,
      secure: true,
    });
    isCloudinaryConfigured = true;
  } else {
    isCloudinaryConfigured = false;
  }
  return isCloudinaryConfigured;
}

// Initial configuration attempt on startup
initCloudinary();

export function isCloudinaryReady() {
  return isCloudinaryConfigured;
}

/**
 * Validates magic bytes / file signatures to prevent MIME spoofing.
 */
export function verifyFileSignature(buffer, declaredMime) {
  if (!buffer || buffer.length < 8) {
    return false;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return declaredMime === 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return declaredMime === 'image/png';
  }

  // WebP: 'RIFF' .... 'WEBP'
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return declaredMime === 'image/webp';
  }

  // PDF: '%PDF-' (25 50 44 46 2D)
  const pdfHeader = buffer.toString('ascii', 0, 5);
  if (pdfHeader.startsWith('%PDF-')) {
    return declaredMime === 'application/pdf';
  }

  return false;
}

/**
 * Sanitizes original filename to prevent path traversal and unsafe characters.
 */
export function sanitizeFilename(originalName = '') {
  const base = path.basename(originalName);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Ensures local upload directory exists.
 */
export function ensureUploadDir() {
  if (!fs.existsSync(config.storage.uploadDir)) {
    fs.mkdirSync(config.storage.uploadDir, { recursive: true });
  }
}

/**
 * Save file locally.
 */
export async function saveLocalFile(fileBuffer, originalName, mimeType) {
  ensureUploadDir();
  const ext = path.extname(originalName).toLowerCase();
  const storageKey = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(config.storage.uploadDir, storageKey);

  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    storageKey,
    cloudinaryPublicId: '',
    storageProvider: 'local',
    resourceType: mimeType === 'application/pdf' ? 'raw' : 'image',
    deliveryType: 'authenticated',
    filePath,
    mimeType,
    fileSize: fileBuffer.length,
    originalName,
    uploadedAt: new Date(),
  };
}

/**
 * Save file to Cloudinary with authenticated / private delivery.
 */
export async function saveCloudinaryFile(fileBuffer, originalName, mimeType) {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary driver is active, but Cloudinary credentials are missing or unconfigured.');
  }

  const isPdf = mimeType === 'application/pdf';
  const resourceType = isPdf ? 'raw' : 'image';
  const ext = path.extname(originalName).toLowerCase();
  const fileId = crypto.randomUUID();
  const publicId = `sifon_complaints/${fileId}${isPdf ? ext : ''}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated', // Protected delivery: asset requires signed URLs
        tags: ['sifon_complaint_attachment'],
      },
      (error, result) => {
        if (error) {
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }
        resolve({
          storageKey: result.public_id,
          cloudinaryPublicId: result.public_id,
          storageProvider: 'cloudinary',
          resourceType: result.resource_type || resourceType,
          deliveryType: result.type || 'authenticated',
          mimeType,
          fileSize: fileBuffer.length,
          originalName,
          uploadedAt: new Date(),
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Unified file upload entry point respecting configured driver.
 * Does NOT silently fall back if cloudinary is selected.
 */
export async function saveAttachmentFile(fileBuffer, originalName, mimeType) {
  if (config.storage.driver === 'cloudinary') {
    if (!isCloudinaryReady()) {
      throw new Error(
        'Cloudinary driver is selected (UPLOAD_DRIVER=cloudinary), but Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env'
      );
    }
    return saveCloudinaryFile(fileBuffer, originalName, mimeType);
  }
  return saveLocalFile(fileBuffer, originalName, mimeType);
}

/**
 * Get readable stream for local file.
 */
export function getLocalFileStream(storageKey) {
  const safeKey = path.basename(storageKey);
  const filePath = path.join(config.storage.uploadDir, safeKey);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.createReadStream(filePath);
}

/**
 * Get absolute path for local file.
 */
export function getLocalFilePath(storageKey) {
  const safeKey = path.basename(storageKey);
  const filePath = path.join(config.storage.uploadDir, safeKey);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return filePath;
}

/**
 * Stream a Cloudinary private file to an HTTP response using signed URL proxying.
 */
export async function streamCloudinaryFile(publicId, resourceType = 'image', res, deliveryType = 'authenticated') {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour signed URL
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType || 'image',
      type: deliveryType || 'authenticated',
      sign_url: true,
      expires_at: expiresAt,
    });

    const response = await fetch(signedUrl, {
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      return res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
        success: false,
        error: {
          code: 'CLOUDINARY_FETCH_FAILED',
          message: `Unable to stream attachment from Cloudinary (HTTP ${response.status})`,
        },
      });
    }

    const upstreamLength = response.headers.get('content-length');
    if (upstreamLength) {
      res.setHeader('Content-Length', upstreamLength);
    }

    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'STREAM_ERROR',
          message: `Streaming failed: ${err.message}`,
        },
      });
    }
  }
}

/**
 * Pre-fetch image buffer for PDF thumbnails (supports local and Cloudinary).
 * Safely handles timeouts and missing images without crashing.
 */
export async function getAttachmentBuffer(attachment) {
  if (!attachment) return null;

  try {
    if (attachment.storageProvider === 'local') {
      const filePath = getLocalFilePath(attachment.storageKey);
      if (filePath && fs.existsSync(filePath)) {
        return await fs.promises.readFile(filePath);
      }
      return null;
    }

    if (attachment.storageProvider === 'cloudinary') {
      if (!isCloudinaryConfigured) return null;

      // Only JPEG and PNG are rendered directly by PDFKit
      const isImage = attachment.mimeType === 'image/jpeg' || attachment.mimeType === 'image/png';
      if (!isImage) return null;

      const targetKey = attachment.storageKey || attachment.cloudinaryPublicId;
      if (!targetKey) return null;

      const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min signed URL
      const signedUrl = cloudinary.url(targetKey, {
        resource_type: attachment.resourceType || 'image',
        type: attachment.deliveryType || 'authenticated',
        sign_url: true,
        expires_at: expiresAt,
      });

      const response = await fetch(signedUrl, {
        signal: AbortSignal.timeout(6000), // 6 second timeout
      });

      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.warn(`[PDF Attachment Warning] Failed to load buffer for ${attachment.originalName}:`, err.message);
    return null;
  }
  return null;
}

/**
 * Delete a stored file (handles both local and Cloudinary).
 */
export async function deleteStoredFile(storageKey, provider = 'local', resourceType = 'image', deliveryType = 'authenticated') {
  if (provider === 'cloudinary') {
    if (!isCloudinaryConfigured) return;
    try {
      await cloudinary.uploader.destroy(storageKey, {
        resource_type: resourceType || 'image',
        type: deliveryType || 'authenticated',
        invalidate: true,
      });
    } catch (err) {
      console.error(`[Storage Warning] Cloudinary delete failed for ${storageKey}:`, err.message);
    }
    return;
  }

  // Local deletion
  const safeKey = path.basename(storageKey);
  const filePath = path.join(config.storage.uploadDir, safeKey);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath).catch(() => {});
  }
}
